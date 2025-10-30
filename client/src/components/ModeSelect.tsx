import React, { useEffect, useRef, useState } from 'react';

type Option = { value: string; label: string };

type Props = {
  id?: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
};

export default function ModeSelect({ id = 'mode-select', value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const selectedIndex = options.findIndex(o => o.value === value);

  useEffect(() => {
    if (open) setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    // when opening, focus the list for keyboard handling
    listRef.current?.focus();
  }, [open]);

  function toggle() {
    setOpen(v => !v);
  }

  function commit(index: number) {
    const opt = options[index];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlight >= 0) commit(highlight);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="custom-select mode-select" ref={rootRef}>
      <label htmlFor={id}>Mode:</label>
      <button
        id={id}
        type="button"
        className="custom-select-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        <span className="custom-select-value">{options[selectedIndex]?.label ?? value}</span>
        <span className="custom-select-caret" aria-hidden>▾</span>
      </button>

      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          className="custom-select-list"
          ref={listRef}
          onKeyDown={onKeyDown}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={
                'custom-select-item' + (i === highlight ? ' highlighted' : '') + (o.value === value ? ' selected' : '')
              }
              onMouseEnter={() => setHighlight(i)}
              onClick={() => commit(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
