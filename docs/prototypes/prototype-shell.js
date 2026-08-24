const shellRoot = document.documentElement;
const shellThemeButton = document.querySelector('.theme-button');

function normalizeFinanceShell() {
  if (!document.body.classList.contains('finance-page')) return;

  const brandImage = document.querySelector('.sidebar .brand img');
  if (brandImage) {
    brandImage.src = '../../assets/brand/White_Logo_v1.png';
    brandImage.alt = 'Pretty Woman Boutique';
  }

  const profile = document.querySelector('.sidebar .profile');
  if (profile) {
    profile.setAttribute('aria-label', 'Abrir perfil de María Pérez');
    profile.innerHTML = '<span class="avatar">MP</span><span><strong>María Pérez</strong><small>Administradora</small></span><span aria-hidden="true">⌄</span>';
  }

  const topbar = document.querySelector('.topbar');
  const menuButton = topbar?.querySelector('.menu-button');
  const title = topbar?.querySelector(':scope > div:not(.top-actions)');
  const actions = topbar?.querySelector('.top-actions');
  if (topbar && menuButton && title && actions) topbar.replaceChildren(menuButton, title, actions);
}

normalizeFinanceShell();

function buildCompleteFinanceNavigation() {
  const navigation = document.createElement('nav');
  navigation.innerHTML = `
    <p class="nav-section-title">Operación</p>
    <a href="../wireframes/index.html#dashboard" title="Resumen" data-label="Resumen"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#home"></use></svg>Resumen</a>
    <a href="sales.html" title="Ventas" data-label="Ventas"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#receipt"></use></svg>Ventas</a>
    <a href="../wireframes/index.html#deliveries" title="Envíos" data-label="Envíos"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#truck"></use></svg>Envíos</a>
    <a href="clients.html" title="Clientes" data-label="Clientes"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#users"></use></svg>Clientes</a>
    <p class="nav-section-title">Inventario</p>
    <a href="products.html" title="Productos" data-label="Productos"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#package"></use></svg>Productos</a>
    <a href="incidents.html" title="Incidencias" data-label="Incidencias"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#alert"></use></svg>Incidencias</a>
    <a href="purchase-orders.html" title="Compras" data-label="Compras"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#clipboard"></use></svg>Compras</a>
    <p class="nav-section-title">Administración</p>
    <a class="is-current" aria-current="page" href="finances.html" title="Finanzas" data-label="Finanzas"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#wallet"></use></svg>Finanzas</a>
    <a href="discount-campaigns.html" title="Campañas" data-label="Campañas"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#campaign"></use></svg>Campañas</a>
    <a href="users.html" title="Usuarios" data-label="Usuarios"><svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#users"></use></svg>Usuarios</a>
  `;
  return navigation;
}

function ensureFinanceNavigation() {
  document.querySelectorAll('.sidebar nav').forEach(nav => {
    const administrationTitle = [...nav.querySelectorAll('.nav-section-title')]
      .find(title => title.textContent.trim() === 'Administración');
    if (!administrationTitle && nav.querySelector('a[href="finances.html"]')) {
      nav.replaceChildren(...buildCompleteFinanceNavigation().childNodes);
      return;
    }
    if (!administrationTitle || nav.querySelector('a[href="finances.html"]')) return;

    const financeLink = document.createElement('a');
    financeLink.href = 'finances.html';
    financeLink.title = 'Finanzas';
    financeLink.dataset.label = 'Finanzas';
    financeLink.innerHTML = '<svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#wallet"></use></svg>Finanzas';
    administrationTitle.insertAdjacentElement('afterend', financeLink);
  });
}

ensureFinanceNavigation();

function ensureUsersNavigation() {
  document.querySelectorAll('.sidebar nav').forEach(nav => {
    if (nav.querySelector('a[href="users.html"], a[data-label="Usuarios"]')) return;

    const usersLink = document.createElement('a');
    usersLink.href = 'users.html';
    usersLink.title = 'Usuarios';
    usersLink.dataset.label = 'Usuarios';
    usersLink.innerHTML = '<svg class="nav-icon" aria-hidden="true"><use href="prototype-icons.svg#users"></use></svg>Usuarios';

    const administrationTitle = [...nav.querySelectorAll('.nav-section-title')]
      .find(title => title.textContent.trim() === 'Administración');
    if (!administrationTitle) {
      nav.append(usersLink);
      return;
    }

    let lastAdministrationLink = administrationTitle;
    let sibling = administrationTitle.nextElementSibling;
    while (sibling && !sibling.classList.contains('nav-section-title')) {
      if (sibling.matches('a')) lastAdministrationLink = sibling;
      sibling = sibling.nextElementSibling;
    }
    lastAdministrationLink.insertAdjacentElement('afterend', usersLink);
  });
}

ensureUsersNavigation();

document.querySelectorAll('a[href="../wireframes/index.html#inventory"]').forEach(link => {
  link.href = 'incidents.html';
});

document.querySelectorAll('a[href="../wireframes/index.html#deliveries"]').forEach(link => {
  link.href = 'shipments.html';
});

const shellIconMarkup = {
  home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  truck: '<path d="M3 6h11v11H3Z"/><path d="M14 10h4l3 3v4h-7Z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M16.5 15a4.5 4.5 0 0 1 4 5"/>',
  package: '<path d="m12 3 9 4.5-9 4.5-9-4.5Z"/><path d="m3 7.5 9 4.5 9-4.5V17l-9 4-9-4Z"/><path d="M12 12v9"/>',
  alert: '<path d="M10.3 4.2 2.7 18a2 2 0 0 0 1.8 3h15a2 2 0 0 0 1.8-3L13.7 4.2a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  clipboard: '<path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M8 11h8M8 15h8"/>',
  tags: '<path d="M3 5v6l9 9 7-7-9-9H4a1 1 0 0 0-1 1Z"/><circle cx="7.5" cy="8.5" r="1"/><path d="m14 4 7 7"/>',
  building: '<path d="M4 21V5l8-3v19M12 8h8v13M8 7v1M8 11v1M8 15v1M16 11v1M16 15v1M2 21h20"/>',
  wallet: '<path d="M4 6h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3h12"/><path d="M16 13h3"/>',
  landmark: '<path d="m3 10 9-6 9 6"/><path d="M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M3 20h18"/>',
  campaign: '<path d="M4 7h16v12H4Z"/><path d="M8 4v6M16 4v6M4 11h16"/><path d="M8 15h3M14 15h2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.1 2.2c-.9.4-.9 1-.9 1.8"/><path d="M12 17h.01"/>'
};

document.querySelectorAll('.nav-icon').forEach(icon => {
  const use = icon.querySelector('use');
  const name = use?.getAttribute('href')?.split('#').pop();
  if (!name || !shellIconMarkup[name]) return;
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.8');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.innerHTML = shellIconMarkup[name];
});

function syncThemeLabel() {
  if (!shellThemeButton) return;
  const dark = shellRoot.dataset.theme === 'dark';
  shellThemeButton.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
}

syncThemeLabel();
shellThemeButton?.addEventListener('click', syncThemeLabel);

const shellMenuButton = document.querySelector('.menu-button');
const shellSidebar = document.querySelector('.sidebar');

if (shellMenuButton && shellSidebar) {
  const shellBackdrop = document.querySelector('.nav-backdrop') || document.createElement('button');
  if (!shellBackdrop.isConnected) {
    shellBackdrop.className = 'nav-backdrop';
    shellBackdrop.type = 'button';
    shellBackdrop.hidden = true;
    shellBackdrop.setAttribute('aria-label', 'Cerrar menú');
    document.body.append(shellBackdrop);
  }
  shellMenuButton.setAttribute('aria-expanded', 'false');

  const closeShellMenu = () => {
    shellSidebar.classList.remove('is-open');
    shellBackdrop.hidden = true;
    shellMenuButton.setAttribute('aria-expanded', 'false');
  };

  shellMenuButton.addEventListener('click', () => {
    const opening = !shellSidebar.classList.contains('is-open');
    shellSidebar.classList.toggle('is-open', opening);
    shellBackdrop.hidden = !opening;
    shellMenuButton.setAttribute('aria-expanded', String(opening));
    if (opening) shellSidebar.querySelector('a')?.focus();
  });
  shellBackdrop.addEventListener('click', closeShellMenu);
  shellSidebar.querySelectorAll('a').forEach(link => link.addEventListener('click', closeShellMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && shellSidebar.classList.contains('is-open')) {
      closeShellMenu();
      shellMenuButton.focus();
    }
  });
}

const customSelects = new WeakMap();

function normalizeSelectText(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function enhanceSelect(select) {
  const nativePurposeSelect = select.matches('.purpose-select') && !select.hasAttribute('data-enhance-select');
  if (customSelects.has(select) || select.matches('[data-native-select]') || nativePurposeSelect || !select.options.length) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'pretty-select';
  const trigger = document.createElement('button');
  trigger.className = 'pretty-select__trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const value = document.createElement('span');
  value.className = 'pretty-select__value';
  const arrow = document.createElement('span');
  arrow.className = 'pretty-select__arrow';
  arrow.setAttribute('aria-hidden', 'true');
  trigger.append(value, arrow);

  const panel = document.createElement('div');
  panel.className = 'pretty-select__panel';
  if (select.hasAttribute('data-viewport-panel')) panel.classList.add('pretty-select__panel--viewport');
  panel.hidden = true;
  const searchable = select.hasAttribute('data-searchable');
  let searchInput = null;
  if (searchable) {
    const search = document.createElement('label');
    search.className = 'pretty-select__search';
    const searchIcon = document.createElement('span');
    searchIcon.setAttribute('aria-hidden', 'true');
    searchIcon.textContent = '⌕';
    searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.autocomplete = 'off';
    searchInput.placeholder = select.dataset.searchPlaceholder || 'Escribe para filtrar…';
    searchInput.setAttribute('aria-label', select.dataset.searchLabel || 'Filtrar opciones');
    search.append(searchIcon, searchInput);
    panel.append(search);
  }
  const list = document.createElement('div');
  list.className = 'pretty-select__options';
  list.setAttribute('role', 'listbox');
  panel.append(list);
  wrapper.append(trigger, panel);
  select.after(wrapper);
  select.classList.add('pretty-select__native');

  let visibleOptions = [];
  let activeIndex = -1;

  const positionPanel = () => {
    if (!select.hasAttribute('data-viewport-panel')) return;
    const triggerRect = trigger.getBoundingClientRect();
    const panelWidth = Math.max(triggerRect.width, 176);
    const viewportGap = 8;
    panel.style.width = `${panelWidth}px`;
    panel.style.left = `${Math.min(Math.max(viewportGap, triggerRect.left), window.innerWidth - panelWidth - viewportGap)}px`;
    const panelHeight = panel.getBoundingClientRect().height;
    const opensAbove = triggerRect.bottom + viewportGap + panelHeight > window.innerHeight
      && triggerRect.top > panelHeight + viewportGap;
    panel.style.top = `${opensAbove ? triggerRect.top - panelHeight - viewportGap : triggerRect.bottom + viewportGap}px`;
  };

  const close = (restoreFocus = false) => {
    wrapper.classList.remove('is-open');
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (searchInput) searchInput.value = '';
    if (restoreFocus) trigger.focus();
  };

  const renderOptions = (query = '') => {
    const needle = normalizeSelectText(query);
    const options = [...select.options].filter(option => !needle || normalizeSelectText(option.textContent).includes(needle));
    list.replaceChildren();
    visibleOptions = [];
    options.forEach(option => {
      const item = document.createElement('button');
      item.className = 'pretty-select__option';
      item.type = 'button';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      item.disabled = option.disabled;
      item.dataset.value = option.value;
      const label = document.createElement('span');
      label.textContent = option.textContent;
      const check = document.createElement('span');
      check.className = 'pretty-select__check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      item.append(label, check);
      item.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        refresh();
        close(true);
      });
      list.append(item);
      if (!option.disabled) visibleOptions.push(item);
    });
    if (!options.length) {
      const empty = document.createElement('p');
      empty.className = 'pretty-select__empty';
      empty.textContent = 'No hay coincidencias';
      list.append(empty);
    }
    activeIndex = visibleOptions.findIndex(item => item.getAttribute('aria-selected') === 'true');
  };

  const refresh = () => {
    const selected = select.selectedOptions[0];
    value.textContent = selected?.textContent || 'Seleccionar';
    wrapper.dataset.value = select.value;
    trigger.disabled = select.disabled;
    trigger.classList.toggle('is-placeholder', !select.value);
    renderOptions(searchInput?.value);
  };

  const open = () => {
    if (select.disabled) return;
    document.querySelectorAll('.pretty-select.is-open').forEach(openSelect => {
      if (openSelect !== wrapper) openSelect.querySelector('.pretty-select__trigger')?.click();
    });
    wrapper.classList.add('is-open');
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    renderOptions();
    positionPanel();
    if (searchInput) searchInput.focus();
    else (visibleOptions[activeIndex] || visibleOptions[0])?.focus();
  };

  const moveActive = direction => {
    if (!visibleOptions.length) return;
    activeIndex = activeIndex < 0 ? 0 : (activeIndex + direction + visibleOptions.length) % visibleOptions.length;
    visibleOptions[activeIndex].focus();
  };

  trigger.addEventListener('click', () => wrapper.classList.contains('is-open') ? close() : open());
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  });
  searchInput?.addEventListener('input', () => renderOptions(searchInput.value));
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
    }
  });
  select.addEventListener('change', refresh);
  select.form?.addEventListener('reset', () => setTimeout(refresh));
  new MutationObserver(refresh).observe(select, { attributes: true, childList: true, subtree: true });
  customSelects.set(select, { refresh, close });
  refresh();
}

document.querySelectorAll('select').forEach(enhanceSelect);
new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    if (mutation.target instanceof HTMLSelectElement) enhanceSelect(mutation.target);
    mutation.addedNodes.forEach(node => {
      if (!(node instanceof Element)) return;
      if (node.matches('select')) enhanceSelect(node);
      node.querySelectorAll?.('select').forEach(enhanceSelect);
    });
  });
}).observe(document.body, { childList: true, subtree: true });

document.addEventListener('pointerdown', event => {
  document.querySelectorAll('.pretty-select.is-open').forEach(wrapper => {
    if (!wrapper.contains(event.target)) customSelects.get(wrapper.previousElementSibling)?.close();
  });
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('.pretty-select.is-open').forEach(wrapper => customSelects.get(wrapper.previousElementSibling)?.close(true));
});
