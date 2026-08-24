(function registerIncidentLogic(global) {
  const typeLabels = {
    damaged: "Dañada",
    dirty: "Sucia",
    missing: "No encontrada",
    "under-review": "En revisión",
    repairing: "En reparación"
  };

  const statusLabels = {
    open: "Abierta",
    "under-review": "En revisión",
    resolved: "Resuelta",
    cancelled: "Cancelada"
  };

  const resolutionLabels = {
    available: "Disponible nuevamente",
    discarded: "Descartada",
    lost: "Pérdida confirmada",
    cancelled: "Incidencia cancelada"
  };

  const normalize = (value) => String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");

  function filter(incidents, filters = {}) {
    const search = normalize(filters.search).trim();
    return incidents.filter((incident) => {
      const matchesSearch = !search || [incident.id, incident.product, incident.ref, incident.variant, incident.size]
        .some((value) => normalize(value).includes(search));
      const matchesType = !filters.type || incident.type === filters.type;
      const matchesStatus = !filters.status || incident.status === filters.status;
      return matchesSearch && matchesType && matchesStatus;
    });
  }

  function resolve(incident, resolution) {
    if (!resolutionLabels[resolution]) return incident;
    return {
      ...incident,
      status: resolution === "cancelled" ? "cancelled" : "resolved",
      resolution,
      availabilityImpact: resolutionLabels[resolution]
    };
  }

  global.IncidentLogic = {
    filter,
    resolve,
    typeLabels,
    statusLabels,
    resolutionLabels
  };
})(typeof globalThis === "undefined" ? window : globalThis);
