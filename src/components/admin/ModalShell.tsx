"use client";

import { useEffect, useId, useRef } from "react";

interface ModalShellProps {
  open: boolean;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

// Stack of open modal ids so Escape only closes the topmost one when modals are nested.
const openModals: string[] = [];

export function ModalShell({ open, title, subtitle, maxWidthClass = "max-w-[1000px]", onClose, footer, children }: ModalShellProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    openModals.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || openModals[openModals.length - 1] !== id) return;
      e.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openModals.lastIndexOf(id);
      if (index !== -1) openModals.splice(index, 1);
      previouslyFocused?.focus?.();
    };
  }, [open, id]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`bg-white rounded-2xl w-full ${maxWidthClass} max-h-[90vh] animate-fade-in flex flex-col overflow-hidden focus:outline-none`}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold text-gray-900 truncate">{title}</h2>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors flex-shrink-0" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 shrink-0 flex gap-3 z-10">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
