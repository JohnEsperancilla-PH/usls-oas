"use client";

import { useEffect, useRef, useState } from "react";

const PREVIEW = "/guides/oasys-visitor-infographic-1200.webp";
const FULL = "/guides/oasys-visitor-infographic-full.webp";
const DOWNLOAD = "/guides/oasys-visitor-infographic.png";
const ALT = "OASYS visitor guide infographic: how to book (go online, enter your details, pick the office and time, submit and wait for approval), what each status means, using your QR code or reference number as your gate pass, and when to arrive on the day of your visit.";

/** The visitor infographic, inline on the guide with a tap-to-enlarge full-screen view. */
export function InfographicViewer() {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const show = () => { setZoomed(false); setOpen(true); };

  return (
    <figure className="!my-0">
      <button ref={triggerRef} type="button" onClick={show} aria-label="Enlarge the visitor guide infographic"
        className="group relative block w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimized file */}
        <img src={PREVIEW} alt={ALT} width={1200} height={1747} className="w-full h-auto" />
        <span className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium shadow group-hover:bg-black/80">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" /></svg>
          Tap to enlarge
        </span>
      </button>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-gray-500">
        <span>Visitor guide at a glance</span>
        <span className="flex items-center gap-3">
          <a href={FULL} target="_blank" rel="noopener" className="text-primary font-medium hover:underline">Open full size</a>
          <a href={DOWNLOAD} download="OASYS-Visitor-Guide.png" className="text-primary font-medium hover:underline">Download</a>
        </span>
      </figcaption>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Visitor guide infographic" className="fixed inset-0 z-[70] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-3 text-white flex-shrink-0">
            <span className="text-sm font-medium truncate">Visitor guide</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setZoomed((z) => !z)} aria-pressed={zoomed}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium">
                {zoomed ? "Fit to screen" : "Zoom in"}
              </button>
              <a href={DOWNLOAD} download="OASYS-Visitor-Guide.png" className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium">Download</a>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close"
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          {/* Clicking the dark area around the image closes the viewer. */}
          <div className="flex-1 overflow-auto overscroll-contain" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className={zoomed ? "w-[200%] sm:w-[1600px] max-w-none mx-auto p-2" : "h-full flex items-start justify-center p-2 sm:p-4"}
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- static, pre-optimized file */}
              <img src={FULL} alt={ALT} width={2953} height={4300} onClick={() => setZoomed((z) => !z)}
                className={zoomed ? "w-full h-auto cursor-zoom-out" : "max-h-full w-auto max-w-full object-contain cursor-zoom-in"} />
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
