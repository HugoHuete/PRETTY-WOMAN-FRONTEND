const icons = {
  edit: "m14 5 5 5M4 20l4.5-1 11-11a3.2 3.2 0 0 0-4.5-4.5l-11 11L4 20Z",
  change: "M11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM2 20v-2a4 4 0 0 1 4-4h3m5-6h7m-3-3 3 3-3 3m3 5h-7m3-3-3 3 3 3",
  remove: "M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5",
};

const colors = {
  edit: "border-blue-200 text-blue-700 hover:bg-blue-50 focus-visible:outline-blue-700",
  change: "border-pw-brand text-pw-brand-deep hover:bg-pw-brand-soft focus-visible:outline-pw-brand",
  remove: "border-red-200 text-red-700 hover:bg-red-50 focus-visible:outline-red-700",
};

export function SaleCardAction({ action, label, disabled, onClick }: {
  action: keyof typeof icons;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={"grid size-10 place-items-center rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 " + colors[action]}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4">
        <path d={icons[action]} />
      </svg>
    </button>
  );
}
