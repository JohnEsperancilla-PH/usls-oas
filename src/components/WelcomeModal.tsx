"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    title: "Book",
    body: "Pick your office, date, and time slot.",
  },
  {
    title: "Get approved",
    body: "The office reviews your request and emails your unique reference number if approved.",
  },
  {
    title: "Enter at the gate",
    body: "Present your reference number and the valid ID you selected at USLS Gate 2 on the day of your visit.",
  },
];

const FAQS = [
  {
    q: "Is an account required?",
    a: "No. Set aside about two minutes to complete the booking form.",
  },
  {
    q: "What do I bring on the day?",
    a: "Your reference number plus the valid ID you selected when booking.",
  },
  {
    q: "Why is my reference number important?",
    a: "It is single-use and proves your appointment. Do not share it.",
  },
  {
    q: "What happens to my personal data?",
    a: "It is processed under the Data Privacy Act of 2012. See the Privacy Policy and Consent to Forms pages for details.",
  },
];

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="welcome-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />

      <div className="relative bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl animate-fade-in">
        <button onClick={close} aria-label="Dismiss welcome message"
          className="absolute top-3 right-3 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 sm:p-8">
<div className="mb-5 pr-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">USLS Online Appointment System</p>
            <h2 id="welcome-title" className="text-xl font-bold text-gray-900">Welcome to OASYS</h2>
          </div>
        </div>

          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            OASYS lets you book time with a USLS office ahead of your visit, so you have a confirmed slot and a faster entry.
            Here is everything you need to know.
          </p>

          <div className="mb-6 rounded-xl bg-primary/5 border border-primary/20 p-4">
            <p className="text-xs text-primary-dark leading-relaxed font-bold">
              If you are planning to visit the ASAO, the University Registrar, the University Bookstore, or the Business Office,
              you do not need to book through OASYS &mdash; you may visit these offices directly.
            </p>
          </div>

          <section className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">How it works</h3>
            <ol className="space-y-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{step.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="mb-6 rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Quick FAQs</h3>
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <p className="text-sm font-medium text-gray-800">{faq.q}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </section>

          <button onClick={close} className="btn-primary w-full">Agree</button>

          <p className="text-center text-xs text-gray-400 mt-4">
            By continuing you agree to the <a href="/terms" className="text-primary hover:underline">Terms of Service</a>{" "}
            and our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}