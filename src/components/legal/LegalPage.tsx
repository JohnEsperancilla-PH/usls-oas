import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/consent", label: "Consent to Forms" },
  { href: "/cookies", label: "Cookie Policy" },
] as const;

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 py-5">
        <div className="container mx-auto px-4 flex items-center justify-between">
          <Link href="/">
            <Image src="/usls-oas.png" alt="USLS OASYS" width={160} height={48} className="h-12 sm:h-14 w-auto" priority />
          </Link>
          <Link href="/" className="text-sm text-primary hover:underline font-medium">
            &larr; Back to Booking
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 sm:py-10 flex-1">
        <div className="max-w-3xl mx-auto">
          <div className="card p-6 sm:p-10">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
            <p className="text-xs text-gray-400 mt-2 mb-6">Last updated: {updated}</p>
            <div className="legal-content">{children}</div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="container mx-auto px-4 text-center text-xs text-gray-400">
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mb-3">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-gray-500 hover:text-primary hover:underline">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="space-y-0.5">
            <p>&copy; {year} OASYS &mdash; Online Appointment System</p>
            <p>
              <a href="https://www.usls.edu.ph" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                University of St. La Salle
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}