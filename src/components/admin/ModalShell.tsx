"use client";

interface ModalShellProps {
  open: boolean;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export function ModalShell({ open, title, subtitle, maxWidthClass = "max-w-[1000px]", onClose, footer, children }: ModalShellProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-2xl w-full ${maxWidthClass} max-h-[90vh] animate-fade-in flex flex-col overflow-hidden`}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{title}</h2>
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