import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export interface DropdownOption<Value extends string> { value: Value; label: string }

interface Props<Value extends string> {
  label: string;
  value: Value;
  options: readonly DropdownOption<Value>[];
  onChange: (value: Value) => void;
  eyebrow?: string;
  icon?: ReactNode;
  className?: string;
}

export function DropdownSelect<Value extends string>({ label, value, options, onChange, eyebrow, icon, className }: Props<Value>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [layout, setLayout] = useState({ above: false, left: 0, width: 220, maxHeight: 280 });
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: '', time: 0 });
  const id = useId();
  const listId = `${id}-list`;
  const valueId = `${id}-value`;
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];

  const show = (index = Math.max(0, selectedIndex)) => {
    search.current = { text: '', time: 0 };
    setActiveIndex(index);
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    setOpen(false);
    onChange(option.value);
    trigger.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!container.current || !menu.current) return;
    const position = () => {
      const anchor = container.current;
      const floating = menu.current;
      if (!anchor || !floating) return;
      const bounds = anchor.getBoundingClientRect();
      let top = 8, bottom = window.innerHeight - 8, left = 8, right = window.innerWidth - 8;
      // Respect the player's clipped edges and the reader's scroll viewport without portals outside a modal.
      for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        if (/auto|scroll|hidden|clip/.test(style.overflowY)) {
          top = Math.max(top, rect.top + parent.clientTop + 8);
          bottom = Math.min(bottom, rect.top + parent.clientTop + parent.clientHeight - 8);
        }
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) {
          left = Math.max(left, rect.left + parent.clientLeft + 8);
          right = Math.min(right, rect.left + parent.clientLeft + parent.clientWidth - 8);
        }
      }
      const below = Math.max(0, bottom - bounds.bottom - 8);
      const above = Math.max(0, bounds.top - top - 8);
      const aboveAnchor = below < Math.min(floating.scrollHeight + 2, 280) && above > below;
      const width = Math.min(Math.max(220, bounds.width), Math.max(0, right - left));
      setLayout({
        above: aboveAnchor,
        left: Math.max(left, Math.min(bounds.right - width, right - width)) - bounds.left,
        width,
        maxHeight: Math.min(280, aboveAnchor ? above : below),
      });
    };
    position();
    const scrolled = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      position();
    };
    window.addEventListener('resize', position);
    if (open) document.addEventListener('scroll', scrolled, true);
    return () => {
      window.removeEventListener('resize', position);
      document.removeEventListener('scroll', scrolled, true);
    };
  }, [open, options]);

  useLayoutEffect(() => {
    if (!open) return;
    const floating = menu.current;
    const option = document.getElementById(`${listId}-${activeIndex}`);
    if (!floating || !option) return;
    const box = floating.getBoundingClientRect();
    const item = option.getBoundingClientRect();
    if (item.top < box.top + 8) floating.scrollTop -= box.top + 8 - item.top;
    else if (item.bottom > box.bottom - 8) floating.scrollTop += item.bottom - box.bottom + 8;
  }, [open, activeIndex, layout.maxHeight, listId]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open]);

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!options.length) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    } else if (event.key === 'Tab') {
      setOpen(false);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) show();
      else setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const index = event.key === 'Home' ? 0 : options.length - 1;
      if (!open) show(index); else setActiveIndex(index);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(activeIndex); else show();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = performance.now();
      const letter = event.key.toLocaleLowerCase();
      const previous = now - search.current.time < 600 ? search.current.text : '';
      const text = previous && [...previous].every(character => character === letter) ? letter : previous + letter;
      search.current = { text, time: now };
      const start = open ? activeIndex : Math.max(0, selectedIndex);
      for (let offset = 1; offset <= options.length; offset++) {
        const index = (start + offset) % options.length;
        if (options[index].label.toLocaleLowerCase().startsWith(text)) {
          setActiveIndex(index); setOpen(true); break;
        }
      }
    }
  };

  return <div ref={container} className={cn('dropdown-select', className)} onKeyDown={keyDown} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" role="combobox" className="dropdown-trigger rounded-full" aria-label={label} aria-describedby={valueId} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined} disabled={!options.length} onClick={() => { if (open) setOpen(false); else show(); }}>
      {icon && <span className="dropdown-icon" aria-hidden="true">{icon}</span>}
      <span className="dropdown-copy">{eyebrow && <span className="dropdown-eyebrow">{eyebrow}</span>}<span id={valueId} className="dropdown-value" title={selected?.label}>{selected?.label ?? 'Choose an option'}</span></span>
      <ChevronDown size={14} className="dropdown-chevron" aria-hidden="true" />
    </button>
    <div ref={menu} className="dropdown-menu rounded-2xl shadow-xl backdrop-blur-md transition-all duration-200 ease-out" data-state={open ? 'open' : 'closed'} data-placement={layout.above ? 'above' : 'below'} aria-hidden={!open} inert={!open} style={{ width: layout.width, maxHeight: layout.maxHeight, left: layout.left, top: layout.above ? undefined : 'calc(100% + 8px)', bottom: layout.above ? 'calc(100% + 8px)' : undefined }}>
      <span className="dropdown-menu-label" aria-hidden="true">{label}</span>
      <ul id={listId} role="listbox" aria-label={label}>
        {options.map((option, index) => <li key={option.value} role="presentation"><button type="button" role="option" tabIndex={-1} id={`${listId}-${index}`} aria-selected={value === option.value} className="dropdown-option" data-active={index === activeIndex} onPointerMove={() => setActiveIndex(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}><span>{option.label}</span><Check size={15} aria-hidden="true" className="dropdown-check" /></button></li>)}
      </ul>
    </div>
  </div>;
}
