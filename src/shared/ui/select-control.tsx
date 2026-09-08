import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectControlProps = {
  id: string;
  name?: string;
  value: string;
  options: SelectOption[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  'aria-label': string;
  disabled?: boolean;
};

export function SelectControl({
  id,
  name,
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  disabled = false,
}: SelectControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const selectedIndex = Math.max(options.findIndex((option) => option.value === value), 0);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const selectOption = (option: SelectOption) => {
    if (option.disabled) return;
    const nativeSelect = wrapperRef.current?.querySelector<HTMLSelectElement>('select');
    if (!nativeSelect) return;
    nativeSelect.value = option.value;
    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const moveActive = (direction: 1 | -1) => {
    const enabledIndexes = options
      .map((option, index) => (option.disabled ? -1 : index))
      .filter((index) => index >= 0);
    if (!enabledIndexes.length) return;
    const currentPosition = enabledIndexes.indexOf(selectedIndex);
    const nextPosition = (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    optionRefs.current[enabledIndexes[nextPosition]]?.focus();
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    setIsOpen(true);
    requestAnimationFrame(() => {
      optionRefs.current[selectedIndex]?.focus();
    });
  };

  return (
    <div
      ref={wrapperRef}
      className={`pw-select-control${isOpen ? ' is-open' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}
    >
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="pw-select-native"
        tabIndex={-1}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        ref={triggerRef}
        type="button"
        className={`pw-select-trigger${!value ? ' is-placeholder' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="pw-select-value">{selectedOption?.label ?? 'Seleccionar'}</span>
        <span className="pw-select-arrow" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="pw-select-panel">
          <div className="pw-select-options" role="listbox" aria-label={ariaLabel}>
            {options.map((option, index) => (
              <button
                key={option.value}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                className="pw-select-option"
                onClick={() => selectOption(option)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveActive(event.key === 'ArrowDown' ? 1 : -1);
                  }
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectOption(option);
                  }
                }}
              >
                <span>{option.label}</span>
                <span className="pw-select-check" aria-hidden="true">✓</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
