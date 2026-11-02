import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { LoadingButton } from "../../shared/ui/loading-button";
import type { PatchSaleDeliveryPayload, SaleDelivery } from "./sales-types";

export function SaleDeliveryEditDialog({ delivery, busy, onClose, onSave }: { delivery: SaleDelivery; busy: boolean; onClose: () => void; onSave: (payload: PatchSaleDeliveryPayload) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState(delivery.code);
  const [address, setAddress] = useState(delivery.deliveryAddress ?? "");
  const [shipping, setShipping] = useState(String(delivery.shippingChargedToClient));
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); return () => dialog.current?.close(); }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await onSave({ code: code.trim(), deliveryAddress: address.trim() || null, shippingChargedToClient: Number(shipping) });
    if (saved) onClose();
  };
  return createPortal(<dialog ref={dialog} aria-labelledby="sale-edit-delivery-title" onCancel={(event) => { event.preventDefault(); onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-pw-line bg-white p-0 text-pw-ink shadow-2xl backdrop:bg-black/50"><form onSubmit={submit} className="space-y-4 p-5"><header className="flex justify-between"><div><h2 id="sale-edit-delivery-title" className="text-lg font-extrabold">Editar envío</h2><p className="mt-1 text-sm text-pw-muted">La agencia y el municipio se conservan.</p></div><button type="button" aria-label="Cerrar" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg border border-pw-line text-xl">×</button></header><label className="grid gap-1 text-xs font-bold text-pw-muted">Código del envío<input required maxLength={40} value={code} onChange={(event) => setCode(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label><label className="grid gap-1 text-xs font-bold text-pw-muted">Monto de envío (C$)<input required type="number" min="0" step="0.01" value={shipping} onChange={(event) => setShipping(event.target.value)} className="min-h-11 rounded-lg border border-pw-line px-3 text-sm" /></label><label className="grid gap-1 text-xs font-bold text-pw-muted">Dirección de entrega<textarea rows={3} value={address} onChange={(event) => setAddress(event.target.value)} className="rounded-lg border border-pw-line px-3 py-2 text-sm" /></label><footer className="flex justify-end gap-2 border-t border-pw-line pt-4"><button type="button" disabled={busy} onClick={onClose} className="min-h-10 rounded-lg border border-pw-line px-3 text-sm font-bold">Cancelar</button><LoadingButton type="submit" isLoading={busy} className="min-h-10 text-sm">Guardar cambios</LoadingButton></footer></form></dialog>, document.body);
}
