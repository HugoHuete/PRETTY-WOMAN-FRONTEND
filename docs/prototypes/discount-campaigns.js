const {
  filterCampaigns,
  getCampaignStatus,
  getLocalDateString,
  loadCampaigns
} = PrettyWomanCampaignData;

const statusLabels = {
  scheduled: { icon: '◷', label: 'Programada' },
  active: { icon: '●', label: 'Activa' },
  finished: { icon: '✓', label: 'Finalizada' },
  disabled: { icon: '⊘', label: 'Deshabilitada' }
};

const pageSize = 5;
const today = getLocalDateString();
const filters = document.querySelector('#campaignFilters');
const search = document.querySelector('#campaignSearch');
const status = document.querySelector('#campaignStatus');
const clearButton = document.querySelector('#clearCampaignFilters');
const table = document.querySelector('#campaignTable');
const rows = document.querySelector('#campaignRows');
const loading = document.querySelector('#campaignLoading');
const loadError = document.querySelector('#campaignError');
const forbidden = document.querySelector('#campaignForbidden');
const empty = document.querySelector('#campaignEmpty');
const noResults = document.querySelector('#campaignNoResults');
const pagination = document.querySelector('#campaignPagination');
const pageButtons = document.querySelector('#campaignPageButtons');
const previousPage = document.querySelector('#previousCampaignPage');
const nextPage = document.querySelector('#nextCampaignPage');
const toast = document.querySelector('#campaignToast');
const query = new URLSearchParams(location.search);

let campaigns = loadCampaigns(localStorage);
let currentPage = 1;

function escapeHTML(value = '') {
  const span = document.createElement('span');
  span.textContent = String(value);
  return span.innerHTML;
}

function formatDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-NI', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day))
    .replace('.', '');
}

function formatUpdated(campaign) {
  if (!campaign.updatedAt) return 'Sin cambios registrados';
  const date = new Date(campaign.updatedAt);
  const label = new Intl.DateTimeFormat('es-NI', { day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace('.', '');
  return `Actualizada ${label}`;
}

function showOnly(target) {
  [loading, loadError, forbidden, table, empty, noResults].forEach(element => {
    element.hidden = element !== target;
  });
  document.querySelector('#campaignList').setAttribute('aria-busy', String(target === loading));
  pagination.hidden = target !== table;
}

function openCampaign(id) {
  location.href = `discount-campaign-edit.html?id=${encodeURIComponent(id)}`;
}

function renderRows(visibleCampaigns) {
  rows.innerHTML = visibleCampaigns.map(campaign => {
    const campaignStatus = getCampaignStatus(campaign, today);
    const statusContent = statusLabels[campaignStatus];
    return `<tr class="campaign-row" data-campaign-id="${campaign.id}">
      <td class="campaign-name-cell"><a class="campaign-edit-link" href="discount-campaign-edit.html?id=${encodeURIComponent(campaign.id)}">${escapeHTML(campaign.name)}</a><small>${escapeHTML(formatUpdated(campaign))} · ${campaign.products.length} ${campaign.products.length === 1 ? 'producto' : 'productos'}</small></td>
      <td class="campaign-date-cell">${formatDate(campaign.startDate)}</td>
      <td class="campaign-date-cell">${formatDate(campaign.endDate)}</td>
      <td><span class="campaign-product-count">${campaign.products.length}</span></td>
      <td><span class="campaign-status campaign-status-${campaignStatus}"><span aria-hidden="true">${statusContent.icon}</span>${statusContent.label}</span></td>
      <td><span class="campaign-open" aria-hidden="true">›</span></td>
    </tr>`;
  }).join('');

  rows.querySelectorAll('.campaign-row').forEach(row => {
    row.addEventListener('click', event => {
      if (event.target.closest('a, button')) return;
      openCampaign(row.dataset.campaignId);
    });
  });
}

function renderPagination(totalItems) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  currentPage = Math.min(currentPage, pageCount);
  previousPage.disabled = currentPage === 1;
  nextPage.disabled = currentPage === pageCount;
  pageButtons.innerHTML = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    return `<button class="${page === currentPage ? 'is-page' : ''}" type="button" data-page="${page}" ${page === currentPage ? 'aria-current="page"' : ''} aria-label="Página ${page}">${page}</button>`;
  }).join('');
  pageButtons.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
    currentPage = Number(button.dataset.page);
    render();
  }));

  const first = totalItems ? ((currentPage - 1) * pageSize) + 1 : 0;
  const last = Math.min(currentPage * pageSize, totalItems);
  document.querySelector('#campaignPaginationText').textContent = `Mostrando ${first}–${last} de ${totalItems}`;
  pagination.hidden = pageCount <= 1;
}

function render() {
  const visibleCampaigns = filterCampaigns(campaigns, { query: search.value, status: status.value }, today);
  clearButton.hidden = !Boolean(search.value.trim() || status.value);

  if (!campaigns.length) {
    showOnly(empty);
    return;
  }

  if (!visibleCampaigns.length) {
    showOnly(noResults);
    return;
  }

  const pageStart = (currentPage - 1) * pageSize;
  renderRows(visibleCampaigns.slice(pageStart, pageStart + pageSize));
  showOnly(table);
  renderPagination(visibleCampaigns.length);
}

function loadCampaignList() {
  showOnly(loading);
  const requestedState = query.get('state');
  window.setTimeout(() => {
    if (requestedState === 'error') {
      showOnly(loadError);
      return;
    }
    if (requestedState === 'forbidden') {
      showOnly(forbidden);
      return;
    }
    if (requestedState === 'empty') campaigns = [];
    render();
  }, 260);
}

function clearFilters() {
  search.value = '';
  status.value = '';
  status.dispatchEvent(new Event('change', { bubbles: true }));
  currentPage = 1;
  render();
}

filters.addEventListener('input', () => {
  currentPage = 1;
  render();
});
filters.addEventListener('change', () => {
  currentPage = 1;
  render();
});
filters.addEventListener('reset', () => window.setTimeout(clearFilters));
document.querySelector('#clearCampaignNoResults').addEventListener('click', clearFilters);
document.querySelector('#retryCampaigns').addEventListener('click', () => {
  query.delete('state');
  loadCampaignList();
});
previousPage.addEventListener('click', () => {
  if (currentPage > 1) currentPage -= 1;
  render();
});
nextPage.addEventListener('click', () => {
  currentPage += 1;
  render();
});

const saved = query.get('saved');
if (saved) {
  toast.textContent = saved === 'created' ? 'Campaña creada correctamente.' : saved === 'disabled' ? 'Campaña deshabilitada.' : 'Cambios guardados correctamente.';
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 3600);
}

const themeButton = document.querySelector('.theme-button');
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
  themeButton.querySelector('.theme-label').textContent = dark ? 'Modo claro' : 'Modo oscuro';
  localStorage.setItem('pw-theme', theme);
}
setTheme(localStorage.getItem('pw-theme') || 'light');
themeButton.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

loadCampaignList();
