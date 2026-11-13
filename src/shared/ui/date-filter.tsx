import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

function displayDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function parseDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

function calendarDate(year: number, month: number, day: number) {
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, month, day);
  return date;
}

export function DateFilter({ id, value, onChange, resetKey = 0 }: { id: string; value: string; onChange: (value: string) => void; resetKey?: number }) {
  const [draft, setDraft] = useState(() => displayDate(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => value ? new Date(`${value}T12:00:00`) : new Date());
  const [yearDraft, setYearDraft] = useState(() => String(month.getFullYear()));
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => { setYearDraft(String(month.getFullYear())); }, [month]);
  useEffect(() => {
    if (open) (popup.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ?? popup.current?.querySelector<HTMLButtonElement>('button[aria-label="Mes anterior"]'))?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    const onOutside = (event: MouseEvent) => { if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    const onScroll = (event: Event) => { if (!popup.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onOutside); window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', onScroll);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onOutside); window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', onScroll); };
  }, [open]);
  const openCalendar = () => {
    if (open) { setOpen(false); return; }
    const rect = trigger.current!.getBoundingClientRect();
    const below = Math.max(0, window.innerHeight - rect.bottom - 16);
    const above = Math.max(0, rect.top - 16);
    const useAbove = below < 410 && above > below;
    const maxHeight = Math.min(410, useAbove ? above : below);
    setPosition({ left: Math.max(8, Math.min(rect.right - 288, window.innerWidth - 296)), top: useAbove ? rect.top - 8 - maxHeight : rect.bottom + 8, maxHeight });
    setMonth(value ? new Date(`${value}T12:00:00`) : new Date());
    setOpen(true);
  };
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = (calendarDate(year, monthIndex, 1).getDay() + 6) % 7;
  const days = calendarDate(year, monthIndex + 1, 0).getDate();
  const selectDay = (day: number) => {
    const iso = `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setDraft(displayDate(iso)); setInvalid(false); onChange(iso); setOpen(false); trigger.current?.focus();
  };
  useEffect(() => { setDraft(displayDate(value)); setInvalid(false); }, [value, resetKey]);
  const commit = () => {
    if (!draft.trim()) { setInvalid(false); onChange(''); return; }
    const parsed = parseDate(draft.trim());
    setInvalid(!parsed);
    if (parsed) onChange(parsed);
  };
  return <span className="grid min-w-0 gap-1">
    <span className={`flex min-h-11 min-w-0 items-center rounded-lg border bg-white focus-within:ring-2 ${invalid ? "border-red-700 focus-within:ring-red-200" : "border-pw-line focus-within:ring-pw-brand/30"}`}>
    <input id={id} type="text" inputMode="numeric" placeholder="dd/mm/aaaa" value={draft} onChange={(event) => { setDraft(event.target.value); setInvalid(false); }} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined} className="min-w-0 w-full bg-transparent px-3 text-sm font-normal text-pw-ink outline-none" />
    <button ref={trigger} type="button" aria-label="Abrir calendario" aria-expanded={open} aria-haspopup="dialog" onClick={openCalendar} className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-md text-pw-muted transition-colors hover:bg-pw-brand-soft hover:text-pw-brand-deep focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pw-brand-deep">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="3.5" y="5.5" width="17" height="15" rx="2" /><path d="M7.5 3.5v4M16.5 3.5v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" /></svg>
    </button>
    </span>
    {open ? createPortal(<div ref={popup} role="dialog" aria-label="Calendario" style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }} className="fixed z-50 w-72 overflow-y-auto rounded-xl border border-pw-line bg-white p-4 text-pw-ink shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <button type="button" aria-label="Mes anterior" onClick={() => setMonth(calendarDate(year, monthIndex - 1, 1))} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep focus-visible:outline-2 focus-visible:outline-pw-brand-deep"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="m12 5-5 5 5 5" /></svg></button>
        <p className="text-sm font-extrabold capitalize text-pw-ink" aria-live="polite">{new Intl.DateTimeFormat('es-NI', { month: 'long', year: 'numeric' }).format(calendarDate(year, monthIndex, 1))}</p>
        <button type="button" aria-label="Mes siguiente" onClick={() => setMonth(calendarDate(year, monthIndex + 1, 1))} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-pw-line text-pw-muted hover:bg-pw-brand-soft hover:text-pw-brand-deep focus-visible:outline-2 focus-visible:outline-pw-brand-deep"><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="m8 5 5 5-5 5" /></svg></button>
      </div>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <label className="relative min-w-0"><span className="sr-only">Mes</span><select aria-label="Mes" value={monthIndex} onChange={(event) => setMonth(calendarDate(year, Number(event.target.value), 1))} className="h-10 w-full appearance-none rounded-lg border border-pw-line bg-white pl-3 pr-8 text-sm font-semibold capitalize text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand-deep">{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{new Intl.DateTimeFormat('es-NI', { month: 'long' }).format(new Date(2020, index, 1))}</option>)}</select><svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-pw-muted"><path d="m5 7 5 5 5-5" /></svg></label>
        <label><span className="sr-only">Año</span><input aria-label="Año" type="number" min="1" max="9999" value={yearDraft} onChange={(event) => setYearDraft(event.target.value)} onBlur={() => { const next = Number(yearDraft); if (Number.isInteger(next) && next >= 1 && next <= 9999) { setMonth(calendarDate(next, monthIndex, 1)); setYearDraft(String(next)); } else setYearDraft(String(year)); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} className="h-10 w-full rounded-lg border border-pw-line bg-white px-2 text-center text-sm font-semibold text-pw-ink focus-visible:outline-2 focus-visible:outline-pw-brand-deep" /></label>
      </div>
      <div className="mt-3 grid grid-cols-7 text-center text-xs font-bold text-pw-muted">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => <span key={index} className="py-2">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-y-1">{Array.from({ length: firstDay }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const date = calendarDate(year, monthIndex, day); const iso = `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return <button type="button" key={day} aria-label={new Intl.DateTimeFormat('es-NI', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)} aria-pressed={value === iso} onClick={() => selectDay(day)} className={`h-9 rounded-lg text-sm font-semibold focus-visible:outline-2 focus-visible:outline-pw-brand-deep ${value === iso ? 'bg-pw-brand text-white' : 'hover:bg-pw-brand-soft'}`}>{day}</button>; })}</div>
    </div>, document.body) : null}
    {invalid ? <span id={`${id}-error`} className="text-xs font-medium text-red-700" role="alert">La fecha no se aplicó. Ingresa una fecha válida en formato día/mes/año.</span> : null}
  </span>;
}
