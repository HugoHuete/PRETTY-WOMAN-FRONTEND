(() => {
  const storageKey = 'pw-finance-demo-v2';
  const canStore = typeof sessionStorage !== 'undefined';

  const seed = {
    balance: 122080,
    movements: [
      { id: 'mov-001', date: '2026-08-21', concept: 'Venta V-1048 · Ana López', type: 'sale', category: 'Venta', origin: 'sale', direction: 'inflow', amount: 1850, source: 'sale-detail.html?id=1048' },
      { id: 'mov-002', date: '2026-08-20', concept: 'Pago de préstamo · Financiera Norte', type: 'loan-payment', category: 'Préstamo', origin: 'loan', direction: 'outflow', amount: 2500, loanId: 'loan-norte', source: 'loan-detail.html?id=loan-norte' },
      { id: 'mov-003', date: '2026-08-20', concept: 'Compra de bolsas y empaque', type: 'expense', category: 'Empaque', origin: 'manual', direction: 'outflow', amount: 680 },
      { id: 'mov-006', date: '2026-08-18', concept: 'Retiro de socia · anticipado', type: 'withdrawal', category: 'Retiros de socias', origin: 'manual', direction: 'outflow', amount: 3200 },
      { id: 'mov-007', date: '2026-08-18', concept: 'Desembolso · Crédito operativo', type: 'loan-disbursement', category: 'Préstamo', origin: 'loan', direction: 'inflow', amount: 18000, loanId: 'loan-norte', source: 'loan-detail.html?id=loan-norte' },
      { id: 'mov-008', date: '2026-08-17', concept: 'Inversión en exhibidor', type: 'investment', category: 'Mejoras de tienda', origin: 'manual', direction: 'outflow', amount: 8500 },
      { id: 'mov-009', date: '2026-08-16', concept: 'Venta V-1043 · Mariela Ríos', type: 'sale', category: 'Venta', origin: 'sale', direction: 'inflow', amount: 1260, source: 'sale-detail.html?id=1043' }
    ],
    loans: [
      {
        id: 'loan-norte', counterparty: 'Financiera Norte', label: 'Crédito operativo', direction: 'received', originalAmount: 18000, balance: 15500,
        status: 'overdue', nextInstallment: 2500, dueDate: '2026-08-20', frequency: 'Quincenal',
        schedule: [
          { number: 1, dueDate: '2026-08-20', amount: 2500, status: 'overdue' },
          { number: 2, dueDate: '2026-09-05', amount: 2500, status: 'upcoming' },
          { number: 3, dueDate: '2026-09-20', amount: 2500, status: 'upcoming' }
        ],
        events: [
          { id: 'loan-event-001', date: '2026-08-18', type: 'disbursement', amount: 18000 },
          { id: 'loan-event-002', date: '2026-08-20', type: 'payment', amount: 2500 }
        ]
      },
      {
        id: 'loan-mora', counterparty: 'Mora Confecciones', label: 'Préstamo a proveedor', direction: 'given', originalAmount: 12000, balance: 7000,
        status: 'due-soon', nextInstallment: 2000, dueDate: '2026-08-27', frequency: 'Mensual',
        schedule: [
          { number: 1, dueDate: '2026-07-27', amount: 3000, status: 'paid' },
          { number: 2, dueDate: '2026-08-27', amount: 2000, status: 'due-soon' },
          { number: 3, dueDate: '2026-09-27', amount: 2000, status: 'upcoming' }
        ],
        events: [
          { id: 'loan-event-003', date: '2026-07-27', type: 'payment', amount: 3000 }
        ]
      }
    ]
  };

  const state = canStore && sessionStorage.getItem(storageKey)
    ? JSON.parse(sessionStorage.getItem(storageKey))
    : JSON.parse(JSON.stringify(seed));

  function persist() {
    if (canStore) sessionStorage.setItem(storageKey, JSON.stringify(state));
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 }).format(amount);
  }

  function getLoan(id) {
    return state.loans.find((loan) => loan.id === id);
  }

  function getBalance() {
    return state.balance;
  }

  function buildMovement(input) {
    return {
      id: `mov-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: input.date || new Date().toISOString().slice(0, 10),
      concept: input.concept.trim(),
      type: input.type,
      category: input.category || 'Sin categoría',
      origin: input.origin || 'manual',
      direction: input.direction,
      amount: Number(input.amount),
      ...input.extra
    };
  }

  function addManualMovement(input) {
    const amount = Number(input.amount);
    if (amount <= 0) {
      return { ok: false, error: 'Ingresa un monto mayor que cero.' };
    }
    if (input.type === 'transfer') {
      return { ok: false, error: 'Los traslados entre cuentas no están disponibles con el saldo general.' };
    }
    if ((input.type === 'expense' && !input.category) || (['withdrawal', 'investment', 'income'].includes(input.type) && !input.purpose)) {
      return { ok: false, error: 'Completa la categoría o el propósito del movimiento.' };
    }
    const concept = input.concept?.trim() || input.purpose?.trim() || input.category?.trim() || 'Movimiento manual';
    const direction = input.type === 'income' ? 'inflow' : 'outflow';
    const movement = buildMovement({ ...input, concept, direction });
    state.movements.unshift(movement);
    state.balance += direction === 'inflow' ? amount : -amount;
    persist();
    return { ok: true, movements: [movement] };
  }

  function addLoanEvent(loanId, input) {
    const loan = getLoan(loanId);
    const amount = Number(input.amount);
    if (!loan || amount <= 0) {
      return { ok: false, error: 'Ingresa un monto mayor que cero.' };
    }
    const type = input.type === 'disbursement' ? 'disbursement' : 'payment';
    if (type === 'payment' && amount > loan.balance) {
      return { ok: false, error: 'El pago no puede ser mayor que el saldo del préstamo.' };
    }
    const incoming = type === 'disbursement' ? loan.direction === 'received' : loan.direction === 'given';
    const event = { id: `loan-event-${Date.now()}`, date: input.date || new Date().toISOString().slice(0, 10), type, amount };
    loan.events.unshift(event);
    loan.balance += type === 'disbursement' ? amount : -amount;
    loan.status = loan.balance === 0 ? 'paid' : loan.status === 'overdue' ? 'overdue' : 'active';
    state.balance += incoming ? amount : -amount;
    const movement = buildMovement({
      amount,
      type: `loan-${type}`,
      category: 'Préstamo',
      concept: `${type === 'disbursement' ? 'Desembolso' : 'Pago'} · ${loan.label}`,
      origin: 'loan',
      direction: incoming ? 'inflow' : 'outflow',
      extra: { loanId: loan.id, source: `loan-detail.html?id=${loan.id}` }
    });
    state.movements.unshift(movement);
    persist();
    return { ok: true, movement, loan };
  }

  window.financeDemo = { ...state, getBalance, formatMoney, getLoan, addManualMovement, addLoanEvent };
})();
