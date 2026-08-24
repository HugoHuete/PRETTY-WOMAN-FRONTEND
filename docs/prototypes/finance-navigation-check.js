const fs = require('node:fs');
const path = require('node:path');

const prototypesDirectory = __dirname;
const adminViews = fs.readdirSync(prototypesDirectory)
  .filter((file) => file.endsWith('.html'))
  .filter((file) => fs.readFileSync(path.join(prototypesDirectory, file), 'utf8').includes('aria-label="Navegación principal"'));

const sharedShell = fs.readFileSync(path.join(prototypesDirectory, 'prototype-shell.js'), 'utf8');
const summarySource = fs.readFileSync(path.join(prototypesDirectory, 'finances.html'), 'utf8');
const retiredFinanceNavigationLabels = ['Catálogos', 'Proveedores', 'Configuración'];
const visibleRetiredLabels = retiredFinanceNavigationLabels.filter((label) =>
  sharedShell.includes(`data-label="${label}"`)
);

if (visibleRetiredLabels.length > 0) {
  throw new Error(`Finanzas muestra enlaces retirados: ${visibleRetiredLabels.join(', ')}`);
}

if (summarySource.includes('href="financial-movements.html?new=1"')) {
  throw new Error('El resumen no debe abrir directamente el diálogo de registro; debe llevar al historial.');
}

const missingFinanceNavigation = adminViews.filter((file) => {
  const source = fs.readFileSync(path.join(prototypesDirectory, file), 'utf8');
  const hasStaticFinanceLink = source.includes('href="finances.html"') && source.includes('>Finanzas</a>');
  const inheritsFinanceLink = source.includes('prototype-shell.js') && sharedShell.includes('ensureFinanceNavigation');
  const usesCompleteSharedMenu = !source.includes('class="finance-page"') || sharedShell.includes('buildCompleteFinanceNavigation');
  return (!hasStaticFinanceLink && !inheritsFinanceLink) || !usesCompleteSharedMenu;
});

if (missingFinanceNavigation.length > 0) {
  throw new Error(`Finanzas falta en el menú lateral de: ${missingFinanceNavigation.join(', ')}`);
}

const financeViewsWithDifferentShell = adminViews.filter((file) => {
  const source = fs.readFileSync(path.join(prototypesDirectory, file), 'utf8');
  if (!source.includes('class="finance-page"')) return false;
  return !source.includes('White_Logo_v1.png')
    || !source.includes('María Pérez')
    || !source.includes('<header class="topbar"><button class="menu-button"')
    || !source.includes('sales-redesign.css');
});

if (financeViewsWithDifferentShell.length > 0) {
  throw new Error(`Finanzas aún usa un shell distinto en: ${financeViewsWithDifferentShell.join(', ')}`);
}

console.log(`finance navigation: ok (${adminViews.length} vistas)`);
