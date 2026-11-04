import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_LINKS } from "@/components/legal/LegalPage";
import type { ViewerRole } from "@/lib/viewer";

const ROLE_LABELS: Record<Exclude<ViewerRole, null>, string> = {
  super_admin: "Super admin",
  office_admin: "Office admin",
  gate_user: "Guard",
  gate_admin: "Guard admin",
};

/** Page frame for the public help pages (/guide, /updates). */
export function HelpShell({ active, role, children }: { active: "guide" | "updates"; role: ViewerRole; children: ReactNode }) {
  const year = new Date().getFullYear();
  const tabs = [
    { key: "guide", href: "/guide", label: "Guide" },
    { key: "updates", href: "/updates", label: "Updates" },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/">
            <Image src="/usls-oas.png" alt="USLS OASYS" width={160} height={48} className="h-11 sm:h-12 w-auto" priority />
          </Link>
          <div className="flex items-center gap-3">
            {role && (
              <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary">
                Signed in as {ROLE_LABELS[role]}
              </span>
            )}
            <Link href="/" className="text-sm text-primary hover:underline font-medium">&larr; Back to Booking</Link>
          </div>
        </div>
        <nav className="container mx-auto px-4 flex gap-1" aria-label="Help pages">
          {tabs.map((tab) => (
            <Link key={tab.key} href={tab.href} aria-current={active === tab.key ? "page" : undefined}
              className={`px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors ${active === tab.key ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="container mx-auto px-4 py-8 sm:py-10 flex-1">{children}</main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="container mx-auto px-4 text-center text-xs text-gray-400">
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 mb-3">
            {[{ href: "/guide", label: "Guide" }, { href: "/updates", label: "Updates" }, ...LEGAL_LINKS].map((link) => (
              <Link key={link.href} href={link.href} className="text-gray-500 hover:text-primary hover:underline">{link.label}</Link>
            ))}
          </nav>
          <p>&copy; {year} OASYS &mdash; Online Appointment System &middot; University of St. La Salle</p>
        </div>
      </footer>
    </div>
  );
}
