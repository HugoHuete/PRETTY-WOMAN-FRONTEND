type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm">
      <button
        className="min-h-11 rounded-lg border border-pw-line px-3 font-bold text-pw-ink hover:bg-pw-canvas disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </button>
      <span className="text-pw-muted">
        Página <strong className="text-pw-ink">{page}</strong> de {totalPages}
      </span>
      <button
        className="min-h-11 rounded-lg border border-pw-line px-3 font-bold text-pw-ink hover:bg-pw-canvas disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
