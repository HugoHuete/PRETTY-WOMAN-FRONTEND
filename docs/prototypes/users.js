const users = [
  { id: 1, name: "María Pérez", email: "maria@prettywoman.com", role: "admin", lastAccess: "Hoy · 8:45 a. m.", createdAt: "12 ene 2026", status: "active" },
  { id: 2, name: "Carla Gómez", email: "carla@prettywoman.com", role: "seller", lastAccess: "Hoy · 8:21 a. m.", createdAt: "3 feb 2026", status: "active" },
  { id: 3, name: "Rosa Martínez", email: "rosa@prettywoman.com", role: "seller", lastAccess: "Ayer · 4:10 p. m.", createdAt: "18 mar 2026", status: "active", loginLocked: true },
  { id: 4, name: "Andrea Solís", email: "andrea@prettywoman.com", role: "seller", lastAccess: "20 jul 2026", createdAt: "2 abr 2026", status: "disabled" },
  { id: 5, name: "Lucía Torres", email: "lucia@prettywoman.com", role: "admin", lastAccess: "18 jul 2026", createdAt: "22 abr 2026", status: "active" },
  { id: 6, name: "Paola Hernández", email: "paola@prettywoman.com", role: "seller", lastAccess: "16 jul 2026", createdAt: "7 may 2026", status: "disabled" },
  { id: 7, name: "Elena Ríos", email: "elena@prettywoman.com", role: "seller", lastAccess: "15 jul 2026", createdAt: "1 jun 2026", status: "active" }
];

const pageSize = 6;
let currentPage = 1;
let editingUserId = null;
let statusUserId = null;
let statusAction = "disable";
let toastTimer;
const root = document.documentElement;
const themeButton = document.querySelector(".theme-button");

const rows = document.querySelector("#userRows");
const tableRegion = document.querySelector("#usersTableRegion");
const emptyState = document.querySelector("#userEmptyState");
const filters = document.querySelector("#userFilters");
const search = document.querySelector("#userSearch");
const role = document.querySelector("#userRole");
const status = document.querySelector("#userStatus");
const clearFilters = document.querySelector("#clearUserFilters");
const userDialog = document.querySelector("#userDialog");
const userForm = document.querySelector("#userForm");
const userStatusDialog = document.querySelector("#userStatusDialog");
const userStatusForm = document.querySelector("#userStatusForm");
const userToast = document.querySelector("#userToast");

function setTheme(theme) {
  root.dataset.theme = theme;
  const dark = theme === "dark";
  themeButton.setAttribute("aria-pressed", String(dark));
  themeButton.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
  themeButton.querySelector(".theme-label").textContent = dark ? "Modo claro" : "Modo oscuro";
  localStorage.setItem("pw-theme", theme);
}

setTheme(localStorage.getItem("pw-theme") || "light");
themeButton.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark"));

const escapeHTML = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[character]));

const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function filteredUsers() {
  const term = normalize(search.value);
  return users.filter((user) => {
    const matchesTerm = !term || normalize(`${user.name} ${user.email}`).includes(term);
    const matchesRole = !role.value || user.role === role.value;
    const matchesStatus = !status.value || user.status === status.value;
    return matchesTerm && matchesRole && matchesStatus;
  });
}

function roleLabel(userRole) {
  return userRole === "admin" ? "Administradora" : "Vendedora";
}

function statusLabel(userStatus) {
  return userStatus === "active" ? "Activo" : "Deshabilitado";
}

function rowMarkup(user) {
  const disabled = user.status === "disabled";
  const loginLocked = Boolean(user.loginLocked);
  return `<tr data-user-id="${user.id}">
    <td><div class="user-identity"><span class="user-avatar">${escapeHTML(initials(user.name))}</span><span><strong>${escapeHTML(user.name)}</strong><small>Usuario #${user.id}</small></span></div></td>
    <td><span class="user-email">${escapeHTML(user.email)}</span></td>
    <td><span class="user-role user-role-${user.role}">${roleLabel(user.role)}</span></td>
    <td><div class="user-status-stack"><span class="user-status user-status-${user.status}"><span aria-hidden="true">${disabled ? "×" : "✓"}</span>${statusLabel(user.status)}</span>${loginLocked ? '<span class="user-lock-status"><span aria-hidden="true">!</span>Bloqueado</span>' : ""}</div></td>
    <td><div class="user-row-actions"><button class="user-text-action" type="button" data-edit-user="${user.id}">Editar</button>${loginLocked ? `<button class="user-text-action is-unlock" type="button" data-unlock-user="${user.id}">Desbloquear</button>` : ""}<button class="user-text-action ${disabled ? "is-enable" : "is-disable"}" type="button" data-status-user="${user.id}" data-status-action="${disabled ? "enable" : "disable"}">${disabled ? "Reactivar" : "Deshabilitar"}</button></div></td>
  </tr>`;
}

function renderPagination(total) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  currentPage = Math.min(currentPage, pages);
  document.querySelector("#userPageNumber").textContent = currentPage;
  document.querySelector("#previousUserPage").disabled = currentPage === 1 || total === 0;
  document.querySelector("#nextUserPage").disabled = currentPage === pages || total === 0;
  const start = total ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, total);
  document.querySelector("#userPaginationText").textContent = total ? `Mostrando ${start}–${end} de ${total}` : "Sin resultados";
}

function render() {
  const matches = filteredUsers();
  const start = (currentPage - 1) * pageSize;
  const pageUsers = matches.slice(start, start + pageSize);
  const hasFilters = Boolean(search.value || role.value || status.value);
  clearFilters.hidden = !hasFilters;
  tableRegion.hidden = pageUsers.length === 0;
  emptyState.hidden = pageUsers.length > 0;
  if (!pageUsers.length) {
    document.querySelector("#userEmptyTitle").textContent = hasFilters ? "No encontramos coincidencias" : "No hay usuarios registrados";
    document.querySelector("#userEmptyText").textContent = hasFilters ? "Prueba con otros datos o limpia los filtros." : "Crea el primer usuario para darle acceso al sistema.";
    document.querySelector("#userEmptyAction").textContent = hasFilters ? "Limpiar filtros" : "Nuevo usuario";
  }
  rows.innerHTML = pageUsers.map(rowMarkup).join("");
  renderPagination(matches.length);
}

function showToast(message) {
  userToast.textContent = message;
  userToast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { userToast.hidden = true; }, 3200);
}

function clearFormErrors() {
  userForm.querySelectorAll(".user-field-error").forEach((error) => { error.textContent = ""; });
  document.querySelector("#userFormMessage").textContent = "";
}

function openUserDialog(user = null) {
  editingUserId = user?.id ?? null;
  userForm.reset();
  clearFormErrors();
  document.querySelector("#userDialogTitle").textContent = user ? "Editar usuario" : "Nuevo usuario";
  document.querySelector("#userDialogKicker").textContent = user ? `Usuario #${user.id}` : "Equipo";
  document.querySelector("#saveUser").textContent = user ? "Guardar cambios" : "Guardar usuario";
  const password = userForm.elements.password;
  password.required = !user;
  password.placeholder = user ? "Dejar en blanco para conservarla" : "Mínimo 8 caracteres";
  document.querySelector("#userPasswordHint").textContent = user ? "Solo completa este campo si deseas cambiarla." : "Mínimo 8 caracteres.";
  if (user) {
    userForm.elements.name.value = user.name;
    userForm.elements.email.value = user.email;
    userForm.elements.role.value = user.role;
  }
  userDialog.showModal();
  userForm.elements.name.focus();
}

function closeUserDialog() {
  userDialog.close();
  editingUserId = null;
}

function saveUser(event) {
  event.preventDefault();
  const fields = userForm.elements;
  const name = fields.name.value.trim();
  const email = fields.email.value.trim().toLowerCase();
  const password = fields.password.value;
  const duplicate = users.some((user) => user.id !== editingUserId && user.email.toLowerCase() === email);
  clearFormErrors();
  if (!name) {
    userForm.querySelector('[data-error-for="name"]').textContent = "Escribe el nombre completo.";
    fields.name.focus();
    return;
  }
  if (!email || !fields.email.validity.valid) {
    userForm.querySelector('[data-error-for="email"]').textContent = "Escribe un correo válido.";
    fields.email.focus();
    return;
  }
  if (duplicate) {
    userForm.querySelector('[data-error-for="email"]').textContent = "Ya existe un usuario con ese correo.";
    fields.email.focus();
    return;
  }
  if ((!editingUserId && password.length < 8) || (password && password.length < 8)) {
    userForm.querySelector('[data-error-for="password"]').textContent = "Usa al menos 8 caracteres.";
    fields.password.focus();
    return;
  }
  if (editingUserId) {
    const user = users.find((item) => item.id === editingUserId);
    user.name = name;
    user.email = email;
    user.role = fields.role.value;
    if (password) user.password = password;
    closeUserDialog();
    render();
    showToast("Cambios del usuario guardados.");
    return;
  }
  users.unshift({ id: Math.max(...users.map((user) => user.id)) + 1, name, email, role: fields.role.value, lastAccess: "Sin acceso todavía", createdAt: "Hoy", status: "active", loginLocked: false, password });
  closeUserDialog();
  currentPage = 1;
  render();
  showToast("Usuario creado correctamente.");
}

function openStatusDialog(user, action) {
  statusUserId = user.id;
  statusAction = action;
  const enabling = action === "enable";
  document.querySelector("#userStatusTitle").textContent = enabling ? `Reactivar a ${user.name}` : `Deshabilitar a ${user.name}`;
  document.querySelector("#userStatusSummary").textContent = enabling
    ? "La cuenta volverá a tener acceso al sistema de inmediato."
    : "La cuenta perderá el acceso al sistema, pero conservarás su información y podrá reactivarse después.";
  const confirm = document.querySelector("#confirmUserStatus");
  confirm.textContent = enabling ? "Reactivar usuario" : "Deshabilitar usuario";
  confirm.className = enabling ? "primary-action" : "danger-action";
  userStatusDialog.showModal();
  confirm.focus();
}

function openUnlockDialog(user) {
  if (!user?.loginLocked) return;
  statusUserId = user.id;
  statusAction = "unlock";
  document.querySelector("#userStatusTitle").textContent = `Desbloquear a ${user.name}`;
  document.querySelector("#userStatusSummary").textContent = "La cuenta podrá iniciar sesión nuevamente. Su estado administrativo no cambiará.";
  const confirm = document.querySelector("#confirmUserStatus");
  confirm.textContent = "Desbloquear usuario";
  confirm.className = "primary-action";
  userStatusDialog.showModal();
  confirm.focus();
}

function closeStatusDialog() {
  userStatusDialog.close();
  statusUserId = null;
}

function saveUserStatus(event) {
  event.preventDefault();
  const user = users.find((item) => item.id === statusUserId);
  if (!user) return;
  if (statusAction === "unlock") {
    user.loginLocked = false;
    closeStatusDialog();
    render();
    showToast("Usuario desbloqueado. Ya puede iniciar sesión.");
    return;
  }
  user.status = statusAction === "enable" ? "active" : "disabled";
  closeStatusDialog();
  render();
  showToast(statusAction === "enable" ? "Usuario reactivado." : "Usuario deshabilitado.");
}

filters.addEventListener("input", () => { currentPage = 1; render(); });
filters.addEventListener("change", () => { currentPage = 1; render(); });
filters.addEventListener("reset", () => window.setTimeout(() => { currentPage = 1; render(); }, 0));
rows.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-user]");
  const statusButton = event.target.closest("[data-status-user]");
  const unlockButton = event.target.closest("[data-unlock-user]");
  if (editButton) openUserDialog(users.find((user) => user.id === Number(editButton.dataset.editUser)));
  if (statusButton) openStatusDialog(users.find((user) => user.id === Number(statusButton.dataset.statusUser)), statusButton.dataset.statusAction);
  if (unlockButton) openUnlockDialog(users.find((user) => user.id === Number(unlockButton.dataset.unlockUser)));
});
document.querySelector("#createUser").addEventListener("click", () => openUserDialog());
document.querySelector("#userEmptyAction").addEventListener("click", () => { if (search.value || role.value || status.value) clearFilters.click(); else openUserDialog(); });
document.querySelector("#previousUserPage").addEventListener("click", () => { currentPage -= 1; render(); });
document.querySelector("#nextUserPage").addEventListener("click", () => { currentPage += 1; render(); });
userForm.addEventListener("submit", saveUser);
document.querySelectorAll("[data-close-user]").forEach((button) => button.addEventListener("click", closeUserDialog));
userStatusForm.addEventListener("submit", saveUserStatus);
document.querySelectorAll("[data-close-user-status]").forEach((button) => button.addEventListener("click", closeStatusDialog));

render();
