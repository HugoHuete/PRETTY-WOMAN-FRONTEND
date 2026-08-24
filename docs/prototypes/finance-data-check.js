const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('docs/prototypes/finance-data.js', 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);

const finance = context.window.financeDemo;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(finance, 'El contrato financiero debe estar disponible en window.financeDemo.');
assert(['sale', 'manual', 'loan'].every((origin) => finance.movements.some((movement) => movement.origin === origin)), 'El historial debe incluir movimientos de venta, manuales y de préstamo.');

assert(typeof finance.getBalance === 'function', 'Finanzas debe exponer un saldo general de la tienda.');
const generalBalance = finance.getBalance();
const generalMovement = finance.addManualMovement({ type: 'expense', amount: 1, concept: 'Prueba de saldo general', category: 'Prueba' });
assert(generalMovement.ok, 'Un movimiento manual no debe requerir seleccionar una cuenta.');
assert(finance.getBalance() === generalBalance - 1, 'Un movimiento manual debe actualizar el saldo general.');
const loanBalance = finance.getBalance();
const loanEvent = finance.addLoanEvent('loan-norte', { amount: 1 });
assert(loanEvent.ok, 'Un pago de préstamo no debe requerir seleccionar una cuenta.');
assert(finance.getBalance() === loanBalance - 1, 'Un pago de préstamo debe actualizar el saldo general.');

const initialBalance = finance.getBalance();
const invalidResult = finance.addManualMovement({ amount: 0, type: 'expense' });

assert(!invalidResult.ok, 'Un movimiento sin monto válido debe rechazarse.');
assert(finance.getBalance() === initialBalance, 'Un movimiento inválido no debe cambiar el saldo general.');

console.log('finance-data contract: ok');
