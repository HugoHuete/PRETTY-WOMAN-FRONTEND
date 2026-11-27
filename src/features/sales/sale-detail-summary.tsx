import { useExchangeRate } from "../../shared/finance/exchange-rate-provider";
import { type SaleDetail, type SalePaymentMovement } from "./sales-types";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", currencyDisplay: "symbol" });
function signedAmount(movement: SalePaymentMovement, amount: number) { return movement.movementDirectionId === 2 ? -amount : amount; }

export function SaleDetailSummary({ sale }: { sale: SaleDetail }) {
  const { storeRate } = useExchangeRate();
  const shipping = sale.totalShippingChargedToClient ?? sale.deliveries
    .filter((delivery) => delivery.deliveryStatusId !== 3)
    .reduce((total, delivery) => total + delivery.shippingChargedToClient, 0);
  const productPaid = sale.paymentMovements.reduce((total, movement) => total + signedAmount(movement, movement.productAmount), 0);
  const shippingPaid = sale.paymentMovements.reduce((total, movement) => total + signedAmount(movement, movement.shippingAmount), 0);
  const paid = productPaid + shippingPaid;
  const total = sale.total + shipping;
  const balance = Math.max(0, total - paid);
  const refundDue = Math.max(0, paid - total);
  const label = refundDue > 0 ? "Por devolver" : balance > 0 ? "Por pagar" : "Pagada";
  const pendingAmount = refundDue > 0 ? refundDue : balance;
  const amounts = (amount: number, color = "text-pw-ink") => (
    <dd className={`flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 text-right font-extrabold tabular-nums ${color}`}>
      <span className="whitespace-nowrap">{money.format(amount)}</span>
      {storeRate && storeRate > 0 ? <span className="whitespace-nowrap text-sm font-semibold text-pw-muted">US{usd.format(amount / storeRate)}</span> : null}
    </dd>
  );
  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm" aria-labelledby="sale-summary-title">
    <header className="flex items-start justify-between gap-3"><div><h2 id="sale-summary-title" className="text-base font-extrabold text-pw-ink">Resumen</h2><p className="mt-1 text-sm text-pw-muted">{sale.productVariants.length} {sale.productVariants.length === 1 ? "prenda" : "prendas"}</p></div></header>
    <dl className="mt-4 space-y-2 border-t border-pw-line pt-3 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-pw-muted">Subtotal</dt><dd className="font-bold tabular-nums">{money.format(sale.subtotal)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-pw-muted">Descuento</dt><dd className="font-bold tabular-nums">− {money.format(sale.totalDiscount)}</dd></div>
      {sale.deliveries.length ? <div className="flex justify-between gap-3"><dt className="text-pw-muted">Envío cobrado</dt><dd className="font-bold tabular-nums">{money.format(shipping)}</dd></div> : null}
      <div className="flex justify-between gap-3 border-t border-pw-line pt-3 text-base"><dt className="font-extrabold">Total</dt>{amounts(total)}</div>
      <div className="flex justify-between gap-3"><dt className="text-pw-muted">Aplicado</dt><dd className="font-bold tabular-nums">{money.format(paid)}</dd></div>
      <div className="flex justify-between gap-3 border-t border-pw-line pt-3"><dt className="font-extrabold">{label}</dt>{amounts(pendingAmount, refundDue || balance ? "text-pw-brand-deep" : "text-green-800")}</div>
    </dl>
  </section>;
}
