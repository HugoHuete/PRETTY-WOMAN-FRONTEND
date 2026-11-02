import { saleCatalogLabel, saleChannels, type SaleDetail, type SalePaymentMovement } from "./sales-types";

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" });
function signedAmount(movement: SalePaymentMovement, amount: number) { return movement.movementDirectionId === 2 ? -amount : amount; }

export function SaleDetailSummary({ sale }: { sale: SaleDetail }) {
  const shipping = sale.totalShippingChargedToClient ?? sale.deliveries
    .filter((delivery) => delivery.deliveryStatusId !== 3)
    .reduce((total, delivery) => total + delivery.shippingChargedToClient, 0);
  const productPaid = sale.paymentMovements.reduce((total, movement) => total + signedAmount(movement, movement.productAmount), 0);
  const shippingPaid = sale.paymentMovements.reduce((total, movement) => total + signedAmount(movement, movement.shippingAmount), 0);
  const paid = productPaid + shippingPaid;
  const total = sale.total + shipping;
  const balance = Math.max(0, total - paid);
  const refundDue = Math.max(0, paid - total);
  const label = refundDue > 0 ? "Por devolver" : balance > 0 ? "Saldo pendiente" : "Pagada";
  const highlight = refundDue > 0 ? money.format(refundDue) : money.format(balance);
  return <section className="rounded-2xl border border-pw-line bg-white p-5 shadow-sm" aria-labelledby="sale-summary-title">
    <header className="flex items-start justify-between gap-3"><div><h2 id="sale-summary-title" className="text-base font-extrabold text-pw-ink">Resumen</h2><p className="mt-1 text-sm text-pw-muted">{sale.productVariants.length} {sale.productVariants.length === 1 ? "prenda" : "prendas"}</p></div><span className="rounded-full bg-pw-brand-soft px-2.5 py-1 text-xs font-bold text-pw-brand-deep">{saleCatalogLabel(sale.saleChannelId, saleChannels, sale.saleChannelName)}</span></header>
    <dl className="mt-4 space-y-3 border-t border-pw-line pt-4 text-sm">
      <div className="flex justify-between gap-3"><dt className="text-pw-muted">Subtotal</dt><dd className="font-bold tabular-nums">{money.format(sale.subtotal)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-pw-muted">Descuentos</dt><dd className="font-bold tabular-nums">− {money.format(sale.totalDiscount)}</dd></div>
      {sale.deliveries.length ? <div className="flex justify-between gap-3"><dt className="text-pw-muted">Envíos</dt><dd className="font-bold tabular-nums">{money.format(shipping)}</dd></div> : null}
      <div className="flex justify-between gap-3 border-t border-pw-line pt-3 text-base"><dt className="font-extrabold">Total</dt><dd className="font-extrabold tabular-nums">{money.format(total)}</dd></div>
      <div className="flex justify-between gap-3"><dt className="text-pw-muted">Aplicado</dt><dd className="font-bold tabular-nums">{money.format(paid)}</dd></div>
      <div className="flex justify-between gap-3 border-t border-pw-line pt-3"><dt className="font-extrabold">{label}</dt><dd className={"font-extrabold tabular-nums " + (refundDue || balance ? "text-pw-brand-deep" : "text-green-800")}>{highlight}</dd></div>
    </dl>
  </section>;
}
