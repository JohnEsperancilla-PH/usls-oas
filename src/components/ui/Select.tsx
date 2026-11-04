"use client";

import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

interface SelectProps {
  id?: string;
  value: string | number;
  // Same shape as a native select's change event, so existing handlers keep working.
  onChange: (event: { target: { value: string } }) => void;
  children: ReactNode;
  // Applied to the wrapper; the global .input class always forces the button to full width.
  className?: string;
  invalid?: boolean;
  size?: "md" | "sm";
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

// Reads <option> children, so call sites keep their existing markup.
function readOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode }>(child) || child.type !== "option") return [];
    const label = textOf(child.props.children);
    return [{ value: String(child.props.value ?? label), label }];
  });
}

const MAX_MENU_HEIGHT = 288;
const MENU_GAP = 4;

// Phones and tablets get a real <select> so iOS and Android show their own pickers.
const TOUCH_QUERY = "(pointer: coarse)";
function subscribeTouch(onChange: () => void) {
  const mql = window.matchMedia(TOUCH_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
function useIsTouch() {
  return useSyncExternalStore(subscribeTouch, () => window.matchMedia(TOUCH_QUERY).matches, () => false);
}

const Chevron = ({ className = "" }: { className?: string }) => (
  <svg className={`w-4 h-4 flex-shrink-0 text-gray-400 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// A styled replacement for <select>, built as an ARIA combobox with a listbox popup.
export function Select({ id, value, onChange, children, className = "", invalid, size = "md", disabled, required, "aria-label": ariaLabel }: SelectProps) {
  const generatedId = useId();
  const buttonId = id || `select-${generatedId}`;
  const listId = `${buttonId}-listbox`;
  const options = readOptions(children);
  const selectedValue = String(value);
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const selected = options[selectedIndex] ?? options[0];

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", timer: 0 });
  const isTouch = useIsTouch();

  // The menu is portalled and fixed so it isn't clipped by scrolling containers such as modals.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - MENU_GAP * 2;
      const above = rect.top - MENU_GAP * 2;
      const openUp = below < 200 && above > below;
      setMenuStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(MAX_MENU_HEIGHT, openUp ? above : below),
        ...(openUp ? { bottom: window.innerHeight - rect.top + MENU_GAP } : { top: rect.bottom + MENU_GAP }),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const openMenu = () => {
    if (disabled || options.length === 0) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== selectedValue) onChange({ target: { value: option.value } });
    setOpen(false);
    buttonRef.current?.focus();
  };

  const findByTyping = (key: string) => {
    window.clearTimeout(typeahead.current.timer);
    typeahead.current.text += key.toLowerCase();
    typeahead.current.timer = window.setTimeout(() => { typeahead.current.text = ""; }, 600);
    const start = open ? activeIndex : selectedIndex;
    const ordered = [...options.slice(start + 1), ...options.slice(0, start + 1)];
    const match = ordered.find((option) => option.label.toLowerCase().startsWith(typeahead.current.text));
    return match ? options.indexOf(match) : -1;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const last = options.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      } else if (event.key.length === 1 && /\S/.test(event.key)) {
        // Like a native select, typing picks a matching option without opening the menu.
        const match = findByTyping(event.key);
        if (match >= 0) onChange({ target: { value: options[match].value } });
      }
      return;
    }
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); setActiveIndex((i) => Math.min(last, i + 1)); break;
      case "ArrowUp": event.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); break;
      case "Home": event.preventDefault(); setActiveIndex(0); break;
      case "End": event.preventDefault(); setActiveIndex(last); break;
      case "Enter":
      case " ": event.preventDefault(); choose(activeIndex); break;
      // Stopped here so an enclosing modal doesn't close too.
      case "Escape": event.preventDefault(); event.stopPropagation(); setOpen(false); break;
      case "Tab": setOpen(false); break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const match = findByTyping(event.key);
          if (match >= 0) setActiveIndex(match);
        }
    }
  };

  if (isTouch) {
    return (
      <div className={`relative ${className}`}>
        <select id={buttonId} value={selectedValue} onChange={(e) => onChange({ target: { value: e.target.value } })}
          disabled={disabled} required={required} aria-label={ariaLabel} aria-invalid={invalid || undefined}
          className={`input appearance-none bg-white pr-10 truncate disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${size === "sm" ? "!py-1.5" : ""} ${invalid ? "input-error" : ""}`}>
          {options.map((option, index) => (
            <option key={`${option.value}-${index}`} value={option.value}>{option.label}</option>
          ))}
        </select>
        <Chevron className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button ref={buttonRef} id={buttonId} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} aria-label={ariaLabel} aria-invalid={invalid || undefined}
        disabled={disabled} onClick={() => (open ? setOpen(false) : openMenu())} onKeyDown={onKeyDown}
        className={`input flex items-center justify-between gap-2 bg-white text-left disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${size === "sm" ? "!py-1.5" : ""} ${invalid ? "input-error" : ""} ${open ? "ring-2 ring-primary/30 border-primary" : ""}`}>
        <span className="truncate">{selected?.label ?? ""}</span>
        <Chevron className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Lets the browser's own required-field check work inside forms. */}
      {required && (
        <input tabIndex={-1} aria-hidden="true" required value={selectedValue} onChange={() => {}}
          onFocus={() => buttonRef.current?.focus()} className="absolute inset-x-0 bottom-0 h-px opacity-0 pointer-events-none" />
      )}

      {open && createPortal(
        <ul ref={listRef} id={listId} role="listbox" aria-labelledby={buttonId} style={menuStyle}
          className="z-[60] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg animate-fade-in">
          {options.map((option, index) => {
            const isSelected = option.value === selectedValue;
            return (
              <li key={`${option.value}-${index}`} id={`${listId}-${index}`} data-index={index} role="option" aria-selected={isSelected}
                onPointerMove={() => setActiveIndex(index)} onPointerDown={(e) => e.preventDefault()} onClick={() => choose(index)}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer ${index === activeIndex ? "bg-primary/10" : ""} ${isSelected ? "font-medium text-primary" : "text-gray-700"}`}>
                <span>{option.label}</span>
                {isSelected && (
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </div>
  );
}
