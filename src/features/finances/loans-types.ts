export type LoanPayment = {
  id: number;
  paymentDate: string;
  createdAt: string;
  amount: number;
  interestAmount: number;
  totalAmount: number;
  exchangeRate: number;
  comments: string | null;
};

export type Loan = {
  id: number;
  loanDate: string;
  createdAt: string;
  loanOwnerId: number;
  loanOwnerName: string;
  initialAmount: number;
  initialAmountUsd: number;
  balance: number;
  interestPaidAmount: number;
  closedAt: string | null;
  comments: string | null;
  exchangeRate: number;
  isActive: boolean;
  payments: LoanPayment[];
};

export type LoanOwner = {
  id: number;
  name: string;
  enabled: boolean;
};

export type LoanFilters = {
  page: number;
  pageSize: number;
  loanOwnerId: number | null;
  isActive: boolean | null;
};

export type PaginatedLoans = {
  items: Loan[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type CreateLoanInput = {
  loanDate?: string | null;
  loanOwnerId: number;
  initialAmount: number;
  comments?: string | null;
};

export type UpdateLoanInput = {
  loanDate?: string | null;
  loanOwnerId: number;
  initialAmount: number;
  comments?: string | null;
};

export type LoanPaymentInput = {
  paymentDate?: string | null;
  amount: number;
  interestAmount: number;
  comments?: string | null;
};

export const defaultLoanFilters: LoanFilters = {
  page: 1,
  pageSize: 20,
  loanOwnerId: null,
  isActive: true,
};

export const loanPageSize = 20;
export const loanMaxPageSize = 100;
