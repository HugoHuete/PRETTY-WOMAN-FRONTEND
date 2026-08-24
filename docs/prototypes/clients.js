const clients = [
  { id: 101, name: 'Karla Rodríguez', phone: '8888-1420', instagram: 'karlarodriguez', messenger: 'Karla Rodríguez', address: 'Residencial Las Colinas, Managua', createdAt: '12 jul 2026', isBlocked: false, isFriend: true, blockedReason: '', comments: 'Prefiere coordinar entregas por Instagram.' },
  { id: 102, name: 'Gabriela Mora', phone: '7712-2045', instagram: 'gabymora', messenger: '', address: 'Carretera a Masaya, km 10.5', createdAt: '8 jul 2026', isBlocked: false, isFriend: false, blockedReason: '', comments: '' },
  { id: 103, name: 'Sofía Castillo', phone: '8650-7721', instagram: '', messenger: 'Sofía Castillo', address: 'Bello Horizonte, Managua', createdAt: '29 jun 2026', isBlocked: false, isFriend: true, blockedReason: '', comments: 'Solicita confirmar disponibilidad antes de reservar.' },
  { id: 104, name: 'María Fernanda López', phone: '8401-3550', instagram: 'maferlopez', messenger: 'Mafer López', address: '', createdAt: '18 jun 2026', isBlocked: true, isFriend: false, blockedReason: 'Dos pedidos no retirados sin previo aviso.', comments: 'Contactar únicamente por teléfono.' },
  { id: 105, name: 'Ana Lucía Ríos', phone: '8992-0174', instagram: 'analurios', messenger: '', address: 'Ciudad Sandino, zona 8', createdAt: '4 jun 2026', isBlocked: false, isFriend: false, blockedReason: '', comments: '' },
  { id: 106, name: 'Elena Pérez', phone: '7533-9081', instagram: '', messenger: 'Elena Pérez M.', address: 'Masaya, barrio San Jerónimo', createdAt: '26 may 2026', isBlocked: false, isFriend: true, blockedReason: '', comments: 'Usualmente compra talla M.' },
  { id: 107, name: 'Diana Martínez', phone: '8234-1168', instagram: 'dianamartinez', messenger: '', address: 'Villa Fontana, Managua', createdAt: '10 may 2026', isBlocked: false, isFriend: false, blockedReason: '', comments: '' },
  { id: 108, name: 'Valeria Gómez', phone: '', instagram: 'vale.gomez', messenger: 'Valeria Gómez', address: 'León, reparto San Juan', createdAt: '2 may 2026', isBlocked: false, isFriend: false, blockedReason: '', comments: 'No tiene número telefónico registrado.' },
  { id: 109, name: 'Paola Hernández', phone: '8890-4412', instagram: 'paolah', messenger: '', address: 'Nindirí, Masaya', createdAt: '21 abr 2026', isBlocked: true, isFriend: false, blockedReason: 'Cuenta duplicada pendiente de verificación.', comments: '' },
  { id: 110, name: 'Andrea Solís', phone: '7670-2941', instagram: '', messenger: '', address: '', createdAt: '11 abr 2026', isBlocked: false, isFriend: false, blockedReason: '', comments: '' },
  { id: 111, name: 'Camila Vega', phone: '8120-9035', instagram: 'camilavega', messenger: 'Camila Vega', address: 'Tipitapa, Managua', createdAt: '28 mar 2026', isBlocked: false, isFriend: true, blockedReason: '', comments: 'Prefiere entregas los sábados.' }
];

const pageSize = 6;
let currentPage = 1;
let editingClientId = null;
let statusClientId = null;
let statusAction = 'block';
let detailClientId = null;
let toastTimer;

const clientRows = document.querySelector('#clientRows');
const clientsTable = document.querySelector('#clientsTable');
const clientLoading = document.querySelector('#clientLoading');
const clientError = document.querySelector('#clientError');
const clientEmpty = document.querySelector('#clientEmpty');
const clientsPagination = document.querySelector('#clientsPagination');
const clientDialog = document.querySelector('#clientDialog');
const clientForm = document.querySelector('#clientForm');
const clientStatusDialog = document.querySelector('#clientStatusDialog');
const clientStatusForm = document.querySelector('#clientStatusForm');
const clientDetailDialog = document.querySelector('#clientDetailDialog');
const clientDetailContent = document.querySelector('#clientDetailContent');
const root = document.documentElement;
const themeButton = document.querySelector('.theme-button');

function setTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === 'dark';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
  themeButton.querySelector('.theme-label').textContent = dark ? 'Modo claro' : 'Modo oscuro';
  localStorage.setItem('pw-theme', theme);
}

setTheme(localStorage.getItem('pw-theme') || 'light');
themeButton.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const initials = name => name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`;

function filteredClients() {
  const name = normalize(document.querySelector('#clientName').value);
  const phone = normalize(document.querySelector('#clientPhone').value).replace(/\D/g, '');
  const socialUser = normalize(document.querySelector('#socialUser').value);
  return clients.filter(client => {
    const matchesName = !name || normalize(client.name).includes(name);
    const matchesPhone = !phone || client.phone.replace(/\D/g, '').includes(phone);
    const matchesSocial = !socialUser || normalize(`${client.instagram} ${client.messenger}`).includes(socialUser);
    return matchesName && matchesPhone && matchesSocial;
  });
}

function rowMarkup(client) {
  return `<tr class="client-row" data-client-id="${client.id}">
    <td><div class="client-identity"><span class="client-avatar">${initials(client.name)}</span><span><strong>${escapeHTML(client.name)}</strong><small>Cliente #${client.id}</small></span></div></td>
    <td>${client.phone ? `<a class="client-phone-link" href="tel:${client.phone.replace(/\D/g, '')}">${escapeHTML(client.phone)}</a>` : '<span class="client-contact-muted">Sin teléfono</span>'}</td>
    <td>${client.instagram ? `<span class="client-social">@${escapeHTML(client.instagram)}</span>` : '<span class="client-contact-muted">Sin usuario</span>'}</td>
    <td>${client.messenger ? `<span class="client-social">${escapeHTML(client.messenger)}</span>` : '<span class="client-contact-muted">Sin usuario</span>'}</td>
    <td>${escapeHTML(client.createdAt)}</td>
    <td><span class="client-status ${client.isBlocked ? 'is-blocked' : 'is-active'}">${client.isBlocked ? 'Bloqueada' : 'Activa'}</span></td>
    <td><div class="client-row-actions">
      <button class="client-icon-action" type="button" data-view-client="${client.id}" aria-label="Ver información de ${escapeHTML(client.name)}" title="Ver información"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2.5 12s3.2-5 9.5-5 9.5 5 9.5 5-3.2 5-9.5 5-9.5-5-9.5-5Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg><span class="sr-only">Ver</span></button>
      <button class="client-icon-action" type="button" data-edit-client="${client.id}" aria-label="Editar información de ${escapeHTML(client.name)}" title="Editar"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 16.5-.8 4.3 4.3-.8L19.8 7.7a2.1 2.1 0 0 0-3-3L4 16.5Z"></path><path d="m14.8 6.2 3 3"></path></svg><span class="sr-only">Editar</span></button>
      <button class="client-icon-action ${client.isBlocked ? 'is-unblock' : 'is-block'}" type="button" data-status-client="${client.id}" data-status-action="${client.isBlocked ? 'unblock' : 'block'}" aria-label="${client.isBlocked ? 'Desbloquear' : 'Bloquear'} a ${escapeHTML(client.name)}" title="${client.isBlocked ? 'Desbloquear' : 'Bloquear'}"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"></rect>${client.isBlocked ? '<path d="M8 10V7a4 4 0 0 1 7.5-2"></path>' : '<path d="M8 10V7a4 4 0 0 1 8 0v3"></path>'}</svg><span class="sr-only">${client.isBlocked ? 'Desbloquear' : 'Bloquear'}</span></button>
    </div></td>
  </tr>`;
}

function detailMarkup(client) {
  return `<div class="client-profile-heading"><span class="client-profile-avatar">${initials(client.name)}</span><div><p>Cliente #${client.id}</p><span class="client-status ${client.isBlocked ? 'is-blocked' : 'is-active'}">${client.isBlocked ? 'Bloqueada' : 'Activa'}</span></div></div>
    <dl class="client-profile-grid">
      <div><dt>Teléfono</dt><dd>${client.phone ? `<a class="client-phone-link" href="tel:${client.phone.replace(/\D/g, '')}">${escapeHTML(client.phone)}</a>` : 'Sin teléfono registrado'}</dd></div>
      <div><dt>Instagram</dt><dd>${client.instagram ? `@${escapeHTML(client.instagram)}` : 'Sin usuario registrado'}</dd></div>
      <div><dt>Messenger</dt><dd>${client.messenger ? escapeHTML(client.messenger) : 'Sin usuario registrado'}</dd></div>
      <div><dt>Amiga de la tienda</dt><dd>${client.isFriend ? 'Sí' : 'No'}</dd></div>
      <div class="client-profile-wide"><dt>Dirección</dt><dd>${escapeHTML(client.address || 'Sin dirección registrada')}</dd></div>
      <div class="client-profile-wide"><dt>Notas</dt><dd>${escapeHTML(client.comments || 'Sin notas registradas.')}</dd></div>
      ${client.isBlocked ? `<div class="client-profile-wide client-profile-blocked"><dt>Motivo del bloqueo</dt><dd>${escapeHTML(client.blockedReason || 'Sin motivo registrado.')}</dd></div>` : ''}
    </dl>`;
}

function renderClients() {
  const matches = filteredClients();
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  currentPage = Math.min(currentPage, pageCount);
  const start = (currentPage - 1) * pageSize;
  const pageClients = matches.slice(start, start + pageSize);
  const hasFilters = ['clientName', 'clientPhone', 'socialUser'].some(id => document.querySelector(`#${id}`).value.trim());

  document.querySelector('#clearClientFilters').hidden = !hasFilters;
  document.querySelector('#clientResultCount').textContent = plural(matches.length, 'clienta', 'clientas');
  document.querySelector('#clientResultContext').textContent = hasFilters ? ' coinciden con los filtros' : ' registradas';
  clientsTable.hidden = pageClients.length === 0;
  clientEmpty.hidden = pageClients.length !== 0;
  clientsPagination.hidden = matches.length <= pageSize;

  if (!pageClients.length) {
    document.querySelector('#clientEmptyTitle').textContent = hasFilters ? 'No encontramos coincidencias' : 'No hay clientas registradas';
    document.querySelector('#clientEmptyText').textContent = hasFilters ? 'Prueba con otros datos o limpia los filtros.' : 'Crea la primera clienta para asociarla a ventas y entregas.';
    document.querySelector('#clientEmptyAction').textContent = hasFilters ? 'Limpiar filtros' : 'Nueva clienta';
  }

  clientRows.innerHTML = pageClients.map(rowMarkup).join('');
  document.querySelector('#clientPaginationText').textContent = matches.length ? `Mostrando ${start + 1}–${Math.min(start + pageSize, matches.length)} de ${matches.length}` : 'Sin resultados';
  renderPagination(pageCount);
}

function renderPagination(pageCount) {
  const buttons = document.querySelector('#clientPageButtons');
  buttons.innerHTML = Array.from({ length: pageCount }, (_, index) => `<button class="${currentPage === index + 1 ? 'is-page' : ''}" type="button" data-client-page="${index + 1}"${currentPage === index + 1 ? ' aria-current="page"' : ''}>${index + 1}</button>`).join('');
  document.querySelector('#previousClientPage').disabled = currentPage === 1;
  document.querySelector('#nextClientPage').disabled = currentPage === pageCount;
}

function showToast(message) {
  const toast = document.querySelector('#clientToast');
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function clearFormErrors() {
  clientForm.querySelectorAll('.field-error').forEach(error => { error.textContent = ''; });
  document.querySelector('#clientFormMessage').textContent = '';
}

function openClientDialog(client = null) {
  editingClientId = client?.id ?? null;
  clearFormErrors();
  clientForm.reset();
  document.querySelector('#clientDialogTitle').textContent = client ? 'Editar clienta' : 'Nueva clienta';
  document.querySelector('#clientDialogKicker').textContent = client ? `Cliente #${client.id}` : 'Directorio';
  document.querySelector('#saveClient').textContent = client ? 'Guardar cambios' : 'Guardar clienta';
  if (client) {
    clientForm.elements.name.value = client.name;
    clientForm.elements.phone.value = client.phone;
    clientForm.elements.instagram.value = client.instagram;
    clientForm.elements.messenger.value = client.messenger;
    clientForm.elements.address.value = client.address;
    clientForm.elements.comments.value = client.comments;
    clientForm.elements.isFriend.checked = client.isFriend;
  }
  clientDialog.showModal();
  clientForm.elements.name.focus();
}

function openStatusDialog(client, action) {
  statusClientId = client.id;
  statusAction = action;
  clientStatusForm.reset();
  document.querySelector('#blockedReasonError').textContent = '';
  const blocking = action === 'block';
  document.querySelector('#clientStatusTitle').textContent = `${blocking ? 'Bloquear' : 'Desbloquear'} a ${client.name}`;
  const blockedReasonField = document.querySelector('#blockedReasonField');
  const blockedReasonInput = clientStatusForm.elements.blockedReason;
  blockedReasonField.hidden = !blocking;
  blockedReasonInput.required = blocking;
  blockedReasonInput.disabled = !blocking;
  clientStatusDialog.classList.toggle('is-unblocking', !blocking);
  const confirmButton = document.querySelector('#confirmClientStatus');
  confirmButton.textContent = blocking ? 'Bloquear clienta' : 'Desbloquear clienta';
  confirmButton.className = blocking ? 'danger-action' : 'primary-action';
  clientStatusDialog.showModal();
  if (blocking) clientStatusForm.elements.blockedReason.focus();
  else confirmButton.focus();
}

function openDetailDialog(client) {
  if (!client) return;
  detailClientId = client.id;
  document.querySelector('#clientDetailKicker').textContent = `Cliente #${client.id}`;
  document.querySelector('#clientDetailTitle').textContent = client.name;
  clientDetailContent.innerHTML = detailMarkup(client);
  const statusButton = document.querySelector('#clientDetailStatus');
  statusButton.className = 'client-modal-status';
  statusButton.textContent = client.isBlocked ? 'Desbloquear' : 'Bloquear';
  statusButton.dataset.statusAction = client.isBlocked ? 'unblock' : 'block';
  clientDetailDialog.showModal();
}

document.querySelector('#clientFilters').addEventListener('input', () => {
  currentPage = 1;
  renderClients();
});

document.querySelector('#clientFilters').addEventListener('change', () => {
  currentPage = 1;
  renderClients();
});

document.querySelector('#clientFilters').addEventListener('reset', () => {
  setTimeout(() => {
    currentPage = 1;
    renderClients();
  });
});

document.querySelector('#clientEmptyAction').addEventListener('click', () => {
  const hasFilters = ['clientName', 'clientPhone', 'socialUser'].some(id => document.querySelector(`#${id}`).value.trim());
  if (hasFilters) document.querySelector('#clientFilters').reset();
  else openClientDialog();
});

document.querySelector('#createClient').addEventListener('click', () => openClientDialog());
document.querySelector('#retryClients').addEventListener('click', () => {
  clientError.hidden = true;
  clientLoading.hidden = false;
  setTimeout(() => {
    clientLoading.hidden = true;
    clientsTable.hidden = false;
    renderClients();
  }, 450);
});

clientRows.addEventListener('click', event => {
  const viewButton = event.target.closest('[data-view-client]');
  const editButton = event.target.closest('[data-edit-client]');
  const statusButton = event.target.closest('[data-status-client]');
  if (event.target.closest('a')) return;
  if (viewButton) {
    openDetailDialog(clients.find(client => client.id === Number(viewButton.dataset.viewClient)));
    return;
  }
  if (editButton) {
    openClientDialog(clients.find(client => client.id === Number(editButton.dataset.editClient)));
    return;
  }
  if (statusButton) {
    openStatusDialog(clients.find(client => client.id === Number(statusButton.dataset.statusClient)), statusButton.dataset.statusAction);
    return;
  }
});

document.querySelector('#clientsPagination').addEventListener('click', event => {
  const pageButton = event.target.closest('[data-client-page]');
  if (pageButton) currentPage = Number(pageButton.dataset.clientPage);
  else if (event.target.id === 'previousClientPage') currentPage -= 1;
  else if (event.target.id === 'nextClientPage') currentPage += 1;
  else return;
  renderClients();
  document.querySelector('#clientsList').focus();
});

document.querySelectorAll('[data-close-client]').forEach(button => button.addEventListener('click', () => clientDialog.close()));
document.querySelectorAll('[data-close-status]').forEach(button => button.addEventListener('click', () => clientStatusDialog.close()));
document.querySelectorAll('[data-close-detail]').forEach(button => button.addEventListener('click', () => clientDetailDialog.close()));

clientDetailDialog.addEventListener('click', event => {
  const client = clients.find(item => item.id === detailClientId);
  if (!client) return;
  if (event.target.closest('[data-detail-edit]')) {
    clientDetailDialog.close();
    openClientDialog(client);
  } else if (event.target.closest('[data-detail-status]')) {
    clientDetailDialog.close();
    openStatusDialog(client, event.target.closest('[data-detail-status]').dataset.statusAction);
  }
});

clientForm.addEventListener('submit', event => {
  event.preventDefault();
  clearFormErrors();
  const name = clientForm.elements.name.value.trim();
  const phone = clientForm.elements.phone.value.trim();
  const instagram = clientForm.elements.instagram.value.trim().replace(/^@/, '').toLowerCase();
  const messenger = clientForm.elements.messenger.value.trim().toLowerCase();
  const phoneDigits = phone.replace(/\D/g, '');
  const currentClient = clients.find(client => client.id === editingClientId);
  let invalid = false;

  if (!name) {
    clientForm.querySelector('[data-error-for="name"]').textContent = 'Ingresa el nombre de la clienta.';
    invalid = true;
  }
  if (phone && phoneDigits.length !== 8) {
    clientForm.querySelector('[data-error-for="phone"]').textContent = 'Ingresa un teléfono válido de ocho dígitos.';
    invalid = true;
  }
  if (phone && clients.some(client => client.id !== editingClientId && client.phone.replace(/\D/g, '') === phoneDigits)) {
    clientForm.querySelector('[data-error-for="phone"]').textContent = 'Ya existe una clienta con este teléfono.';
    invalid = true;
  }
  if (instagram && clients.some(client => client.id !== editingClientId && normalize(client.instagram) === normalize(instagram))) {
    clientForm.querySelector('[data-error-for="instagram"]').textContent = 'Este usuario de Instagram ya está registrado.';
    invalid = true;
  }
  if (messenger && clients.some(client => client.id !== editingClientId && normalize(client.messenger) === normalize(messenger))) {
    clientForm.querySelector('[data-error-for="messenger"]').textContent = 'Este usuario de Messenger ya está registrado.';
    invalid = true;
  }
  if (invalid) {
    clientForm.querySelector('.field-error:not(:empty)')?.closest('label')?.querySelector('input, textarea')?.focus();
    return;
  }

  const values = {
    name,
    phone: phoneDigits ? `${phoneDigits.slice(0, 4)}-${phoneDigits.slice(4)}` : '',
    instagram,
    messenger: clientForm.elements.messenger.value.trim(),
    address: clientForm.elements.address.value.trim(),
    comments: clientForm.elements.comments.value.trim(),
    isFriend: clientForm.elements.isFriend.checked
  };
  if (currentClient) Object.assign(currentClient, values);
  else clients.unshift({ id: Math.max(...clients.map(client => client.id)) + 1, createdAt: 'Hoy', isBlocked: false, blockedReason: '', ...values });

  clientDialog.close();
  currentPage = 1;
  renderClients();
  showToast(currentClient ? `Los datos de ${name} fueron actualizados.` : `${name} fue agregada al directorio.`);
});

clientStatusForm.addEventListener('submit', event => {
  event.preventDefault();
  const client = clients.find(item => item.id === statusClientId);
  if (!client) return;
  if (statusAction === 'block') {
    const reason = clientStatusForm.elements.blockedReason.value.trim();
    if (!reason) {
      document.querySelector('#blockedReasonError').textContent = 'Ingresa el motivo del bloqueo.';
      clientStatusForm.elements.blockedReason.focus();
      return;
    }
    client.isBlocked = true;
    client.blockedReason = reason;
  } else {
    client.isBlocked = false;
    client.blockedReason = '';
  }
  clientStatusDialog.close();
  renderClients();
  showToast(`${client.name} fue ${client.isBlocked ? 'bloqueada' : 'desbloqueada'}.`);
});

setTimeout(() => {
  clientLoading.hidden = true;
  document.querySelector('#clientsList').setAttribute('aria-busy', 'false');
  renderClients();
}, 500);
