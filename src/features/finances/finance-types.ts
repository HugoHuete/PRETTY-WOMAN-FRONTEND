export type MovementDirectionId = 1 | 2;

export type FinanceMovementFilters = {
  page: number;
  pageSize: number;
  fromDate: string;
  toDate: string;
  financialMovementTypeId: number | null;
  movementDirectionId: MovementDirectionId | null;
};

export type FinancialMovement = {
  id: number;
  description: string;
  movementDate: string;
  createdAt: string;
  movementDirectionId: number;
  movementDirectionName: string | null;
  movementDirectionLabel: string;
  financialMovementTypeId: number;
  financialMovementTypeName: string | null;
  financialMovementTypeLabel: string;
  expenseCategoryId: number | null;
  orderId: number | null;
  salePaymentMovementId: number | null;
  deliveryAgencyReconciliationId: number | null;
  loanId: number | null;
  loanPaymentId: number | null;
  amount: number;
  exchangeRate: number;
  comments: string | null;
  originLabel: string;
};

export type FinancialMovementType = {
  id: number;
  name: string;
  label: string;
};

export type PaginatedFinanceMovements = {
  items: FinancialMovement[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export const defaultFinanceMovementFilters: FinanceMovementFilters = {
  page: 1,
  pageSize: 20,
  fromDate: "",
  toDate: "",
  financialMovementTypeId: null,
  movementDirectionId: null,
};

export const financeMovementPageSize = 20;
export const financeMovementMaxPageSize = 100;
