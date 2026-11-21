const catalogPaths = new Set([
  '/api/v1/categories',
  '/api/v1/subcategories',
  '/api/v1/sizes',
  '/api/v1/deliveryagencies',
  '/api/v1/paymentterminals',
  '/api/v1/finances/movement-types',
  '/api/v1/municipalities',
  '/api/v1/suppliers',
]);

const catalogLifetimeMs = 24 * 60 * 60 * 1000;

type CatalogEntry = {
  expiresAt: number;
  items: unknown[];
};

type CatalogResponse = {
  response: Response;
  scope: readonly string[];
};

function readEntry(key: string): CatalogEntry | undefined {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return undefined;
    const entry = JSON.parse(stored) as Partial<CatalogEntry> | null;
    if (entry && Number.isFinite(entry.expiresAt) && Array.isArray(entry.items)) {
      return entry as CatalogEntry;
    }
  } catch {
    // Treat unavailable storage and malformed entries as cache misses.
  }
}

export class CatalogCache {
  private readonly entries = new Map<string, CatalogEntry>();
  private readonly pending = new Map<string, Promise<Response>>();

  async request(
    path: string,
    init: RequestInit,
    scope: readonly string[],
    now: () => number,
    fetchCatalog: () => Promise<CatalogResponse>,
  ): Promise<Response> {
    if (!catalogPaths.has(path) || Object.keys(init).length > 0) {
      return (await fetchCatalog()).response;
    }

    const key = `pw-catalog-v1:${JSON.stringify([...scope, path])}`;
    const requestedAt = now();
    const memoryEntry = this.entries.get(key);
    if (memoryEntry && memoryEntry.expiresAt > requestedAt) {
      return Response.json(memoryEntry.items);
    }
    this.entries.delete(key);

    const cached = readEntry(key);
    if (cached && cached.expiresAt > requestedAt) {
      this.entries.set(key, cached);
      return Response.json(cached.items);
    }

    let pending = this.pending.get(key);
    if (!pending) {
      pending = this.fetchAndStore(key, scope, now, fetchCatalog)
        .finally(() => this.pending.delete(key));
      this.pending.set(key, pending);
    }
    return (await pending).clone();
  }

  private async fetchAndStore(
    key: string,
    scope: readonly string[],
    now: () => number,
    fetchCatalog: () => Promise<CatalogResponse>,
  ): Promise<Response> {
    const { response, scope: responseScope } = await fetchCatalog();
    const sameScope = scope.length === responseScope.length &&
      scope.every((value, index) => value === responseScope[index]);
    if (!sameScope) {
      throw new Error('La sesión cambió durante la consulta del catálogo. Vuelve a intentarlo.');
    }
    if (response.status !== 200) return response;

    const items: unknown = await response.clone().json().catch(() => undefined);
    if (!Array.isArray(items)) return response;

    const entry = { expiresAt: now() + catalogLifetimeMs, items };
    this.entries.set(key, entry);
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // The in-memory cache still works when storage is blocked or full.
    }
    return response;
  }
}
