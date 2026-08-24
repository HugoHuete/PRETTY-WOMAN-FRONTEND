const finance = window.financeDemo;
const root = document.documentElement;
const periodFilter = document.querySelector('#periodFilter');

function setTheme(theme) {
  root.dataset.theme = theme;
  const button = document.querySelector('.theme-button');
  const dark = theme === 'dark';
  button.setAttribute('aria-pressed', String(dark));
  button.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
  button.querySelector('.theme-label').textContent = dark ? 'Modo claro' : 'Modo oscuro';
  localStorage.setItem('pw-theme', theme);
}

function statusLabel(status) { return ({ overdue: 'Vencido', 'due-soon': 'Próximo a vencer', active: 'Activo', paid: 'Pagado' })[status] || 'Activo'; }
function originLabel(origin) { return ({ manual: 'Manual', sale: 'Venta', loan: 'Préstamo' })[origin] || 'Finanzas'; }
function filteredMovements() { return periodFilter.value === 'all' ? finance.movements : finance.movements.filter((movement) => movement.date.startsWith(periodFilter.value)); }

function render() {
  const movements = filteredMovements();
  const total = finance.getBalance();
  const inflows = movements.filter((movement) => movement.direction === 'inflow').reduce((sum, movement) => sum + movement.amount, 0);
  const outflows = movements.filter((movement) => movement.direction === 'outflow').reduce((sum, movement) => sum + movement.amount, 0);
  document.querySelector('#totalAvailable').textContent = finance.formatMoney(total);
  document.querySelector('#periodInflows').textContent = finance.formatMoney(inflows);
  document.querySelector('#periodOutflows').textContent = finance.formatMoney(outflows);
  document.querySelector('#accountList').innerHTML = `<article class="account-card"><div><strong>Dinero de la tienda</strong><small>Saldo general disponible para la operación.</small></div><output>${finance.formatMoney(total)}</output></article>`;
  const urgent = [...finance.loans].filter((loan) => ['overdue', 'due-soon'].includes(loan.status)).sort((a, b) => a.status === 'overdue' ? -1 : b.status === 'overdue' ? 1 : a.dueDate.localeCompare(b.dueDate));
  document.querySelector('#loanAlerts').innerHTML = urgent.length ? urgent.map((loan) => `<a class="loan-alert" href="loan-detail.html?id=${loan.id}"><span class="status-badge is-${loan.status}">${statusLabel(loan.status)}</span><strong>${loan.label}</strong><small>${loan.counterparty} · cuota ${finance.formatMoney(loan.nextInstallment)} · ${loan.dueDate}</small></a>`).join('') : '<p class="finance-empty">No hay cuotas pendientes en este período.</p>';
  document.querySelector('#activityList').innerHTML = movements.length ? [...movements].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((movement) => `<a class="activity-row" href="${movement.source || 'financial-movements.html'}"><div><strong>${movement.concept}</strong><small>${movement.date} · ${originLabel(movement.origin)}</small></div><output class="amount-${movement.direction}">${movement.direction === 'inflow' ? '+' : '−'}${finance.formatMoney(movement.amount)}</output></a>`).join('') : '<p class="finance-empty">No hay movimientos para este período. Cambia el filtro para consultar otro rango.</p>';
}

setTheme(localStorage.getItem('pw-theme') || 'light');
document.querySelector('.theme-button').addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));
periodFilter.addEventListener('change', render);
render();
