import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { LoadingButton } from "../../shared/ui/loading-button";
import { SelectControl } from "../../shared/ui/select-control";
import { salePaymentMethods, type SaleCatalogOption, type SalePaymentMovement, type UpdateSalePaymentMovementPayload } from "./sales-types";
import type { RefundSalePaymentMovementPayload } from "./sales-types";

export function SalePaymentEditDialog({ movement, terminals, busy, onClose, onSave }: { movement: SalePaymentMovement; terminals: SaleCatalogOption[]; busy: boolean; onClose: () => void; onSave: (payload: UpdateSalePaymentMovementPayload) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [method, setMethod] = useState(String(movement.paymentMethodId));
  const [terminal, setTerminal] = useState(String(movement.paymentTerminalId ?? ""));
  const [productAmount, setProductAmount] = useState(String(movement.productAmount));
  const [shippingAmount, setShippingAmount] = useState(String(movement.shippingAmount));
  const [error, setError] = useState("");
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); return () => dialog.current?.close(); }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const product = Number(productAmount), shipping = Number(shippingAmount);
    if (product < 0 || shipping < 0 || product + shipping <= 0) { setError("Los montos aplicados deben ser positivos y no pueden ser negativos."); return; }
    const methodId = Number(method.startsWith("terminal:") ? 3 : method);
    const saved = await onSave({ paymentMethodId: methodId, paymentTerminalId: methodId === 3 ? Number(method.startsWith("terminal:") ? method.slice(9) : terminal) : null, productAmount: product, shippingAmount: shipping });
    if (saved) onClose();
  };
  const options = [...salePaymentMethods.map((item) => ({ value: String(item.id), label: item.name })), ...terminals.map((item) => ({ value: `terminal:${item.id}`, label: item.name }))];
  return createPortal(<dialog ref={dialog} aria-labelledby="sale-edit-payment-title" onCancel={(event) => { event.preventDefault(); onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50"><form onSubmit={submit} className="space-y-4 p-5"><header className="flex justify-between"><div><h2 id="sale-edit-payment-title" className="text-lg font-extrabold">Corregir pago</h2><p className="mt-1 text-sm text-pw-muted">Cambia el método o la distribución del monto.</p></div><button type="button" onClick={onClose} aria-label="Cerrar" className="grid h-9 w-9 place-items-center rounded-lg border border-pw-line text-xl">×</button></header><label className="grid gap-1 text-xs font-bold text-pw-muted">Método de pago<SelectControl id="edit-sale-payment-method" aria-label="Método de pago" value={method} options={options} onChange={(event) => setMethod(event.target.value)} /></label>{method === "3" ? <label className="grid gap-1 text-xs font-bold text-pw-muted">Terminal<SelectControl id="edit-sale-payment-terminal" aria-label="Terminal de tarjeta" value={terminal} options={[{ value: "", label: "Seleccionar terminal" }, ...terminals.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={(event) => setTerminal(event.target.value)} /></label> : null}<div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-pw-muted">Aplicado a productos<input type="number" min="0" step="0.01" value={productAmount} onChange={(event) => setProductAmount(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label><label className="grid gap-1 text-xs font-bold text-pw-muted">Aplicado al envío<input type="number" min="0" step="0.01" value={shippingAmount} onChange={(event) => setShippingAmount(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label></div>{error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}<footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy} className="min-h-10 text-sm">Guardar corrección</LoadingButton></footer></form></dialog>, document.body);
}

export function SalePaymentRefundButton({ movement, refundedProductAmount, refundedShippingAmount, busy, onRefund }: { movement: SalePaymentMovement; refundedProductAmount: number; refundedShippingAmount: number; busy: boolean; onRefund: (payload: RefundSalePaymentMovementPayload) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [partialRefundOpen, setPartialRefundOpen] = useState(false);
  const [error, setError] = useState("");
  const remainingProductAmount = Math.max(0, movement.productAmount - refundedProductAmount);
  const remainingShippingAmount = Math.max(0, movement.shippingAmount - refundedShippingAmount);
  const [productAmount, setProductAmount] = useState(String(remainingProductAmount));
  const [shippingAmount, setShippingAmount] = useState(String(remainingShippingAmount));
  const canRefundPartially = [1, 2].includes(movement.paymentMethodId) && movement.amountReceivedUsd === 0;
  const amount = remainingProductAmount + remainingShippingAmount;
  const openPartialRefund = () => {
    setProductAmount(String(remainingProductAmount));
    setShippingAmount(String(remainingShippingAmount));
    setError("");
    setPartialRefundOpen(true);
  };
  useEffect(() => {
    if (partialRefundOpen && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!partialRefundOpen && dialog.current?.open) dialog.current.close();
    return () => dialog.current?.close();
  }, [partialRefundOpen]);
  const refund = async () => {
    if (amount <= 0 || !window.confirm(`¿Confirmas el reembolso de ${new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" }).format(amount)}?`)) return;
    await onRefund({ paymentMethodId: movement.paymentMethodId, ...(movement.paymentTerminalId ? { paymentTerminalId: movement.paymentTerminalId } : {}), productAmount: movement.productAmount, shippingAmount: movement.shippingAmount });
  };
  const submitPartialRefund = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const product = Number(productAmount);
    const shipping = Number(shippingAmount);
    if (!Number.isFinite(product) || !Number.isFinite(shipping) || product < 0 || shipping < 0 || product > remainingProductAmount || shipping > remainingShippingAmount || product + shipping <= 0) {
      setError("Ingresa un monto mayor que cero y dentro del saldo disponible de cada concepto.");
      return;
    }
    const saved = await onRefund({ paymentMethodId: movement.paymentMethodId, productAmount: product, shippingAmount: shipping });
    if (saved) setPartialRefundOpen(false);
  };
  return <>
    <button type="button" disabled={busy} onClick={() => canRefundPartially ? openPartialRefund() : void refund()} className="min-h-8 rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50">Reembolsar</button>
    {partialRefundOpen ? <dialog ref={dialog} aria-labelledby={`sale-refund-title-${movement.id}`} onCancel={(event) => { event.preventDefault(); setPartialRefundOpen(false); }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50">
      <form onSubmit={(event) => void submitPartialRefund(event)} className="space-y-4 p-5">
        <header className="flex items-start justify-between gap-3"><div><h2 id={`sale-refund-title-${movement.id}`} className="text-lg font-extrabold">Reembolsar pago</h2><p className="mt-1 text-sm text-pw-muted">Indica cuánto devolver de cada concepto.</p></div><button type="button" disabled={busy} onClick={() => setPartialRefundOpen(false)} aria-label="Cerrar" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-xl">×</button></header>
        <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-pw-muted">Productos (máx. {new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" }).format(remainingProductAmount)})<input autoFocus type="number" min="0" max={remainingProductAmount} step="0.01" inputMode="decimal" value={productAmount} onChange={(event) => { setProductAmount(event.target.value); setError(""); }} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm text-pw-ink" /></label><label className="grid gap-1 text-xs font-bold text-pw-muted">Envío (máx. {new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" }).format(remainingShippingAmount)})<input type="number" min="0" max={remainingShippingAmount} step="0.01" inputMode="decimal" value={shippingAmount} onChange={(event) => { setShippingAmount(event.target.value); setError(""); }} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm text-pw-ink" /></label></div>
        <p className="flex justify-between border-t border-pw-line pt-3 text-sm"><span className="text-pw-muted">Total a reembolsar</span><strong className="tabular-nums">{new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO" }).format((Number(productAmount) || 0) + (Number(shippingAmount) || 0))}</strong></p>
        {error ? <p role="alert" className="text-sm font-bold text-red-700">{error}</p> : null}
        <footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={() => setPartialRefundOpen(false)} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy} className="min-h-10 text-sm">Confirmar reembolso</LoadingButton></footer>
      </form>
    </dialog> : null}
  </>;
}
