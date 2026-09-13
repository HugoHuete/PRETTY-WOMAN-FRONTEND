import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

type SelectControlProps = {
  id: string;
  name?: string;
  value: string;
  options: SelectOption[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  'aria-label': string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
};

export function SelectControl({
  id,
  name,
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Buscar…',
}: SelectControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];
  const visibleOptions = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm.trim());
    if (!normalizedSearch) return options;
    return options.filter((option) => normalizeSearch(option.label).includes(normalizedSearch));
  }, [options, searchTerm]);
  const selectedIndex = Math.max(visibleOptions.findIndex((option) => option.value === value), 0);

  const close = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  useEffect(() => {
    if (isOpen && searchable) searchRef.current?.focus();
  }, [isOpen, searchable]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) close();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
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
    close();
    triggerRef.current?.focus();
  };

  const moveActive = (direction: 1 | -1) => {
    const enabledIndexes = visibleOptions
      .map((option, index) => (option.disabled ? -1 : index))
      .filter((index) => index >= 0);
    if (!enabledIndexes.length) return;
    const currentPosition = enabledIndexes.indexOf(selectedIndex);
    const nextPosition = (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    optionRefs.current[enabledIndexes[nextPosition]]?.focus();
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setIsOpen(true);
    requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      else optionRefs.current[selectedIndex]?.focus();
    });
  };

  return (
    <div
      ref={wrapperRef}
      className={`pw-select-control${isOpen ? ' is-open' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
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
        onClick={(event) => {
          // Keyboard activation dispatches a click after keydown. Keep the
          // control open instead of toggling it closed again.
          if (event.detail === 0) {
            setIsOpen(true);
            return;
          }
          setIsOpen((open) => !open);
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="pw-select-value font-normal">{selectedOption?.label ?? 'Seleccionar'}</span>
        <span className="pw-select-arrow" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="pw-select-panel">
          {searchable ? (
            <div className="pw-select-search-wrap">
              <input
                ref={searchRef}
                className="pw-select-search"
                type="search"
                value={searchTerm}
                placeholder={searchPlaceholder}
                aria-label={`Buscar ${ariaLabel.toLocaleLowerCase()}`}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    optionRefs.current[0]?.focus();
                  }
                }}
              />
            </div>
          ) : null}
          <div className="pw-select-options" role="listbox" aria-label={ariaLabel}>
            {visibleOptions.length ? visibleOptions.map((option, index) => (
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
            )) : <p className="pw-select-empty">No encontramos resultados.</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
