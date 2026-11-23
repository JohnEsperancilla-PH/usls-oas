"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Office } from "@/types/database";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { effectiveCategory, orderOfficesAsTree, type OfficeTreeEntry } from "@/lib/office-tree";
import { OFFICE_OFFLINE_LABEL } from "@/lib/office-online";

export default function OfficesPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/offices")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setOffices(data))
      .catch(() => setOffices([]))
      .finally(() => setLoading(false));
  }, []);

  const q = query.trim().toLowerCase();
  const matches = (o: Office) => o.name.toLowerCase().includes(q) || (effectiveCategory(o, offices) || "").toLowerCase().includes(q);
  // A matching sub-office keeps its main office visible above it, and a matching main office shows its sub-offices.
  const visible = orderOfficesAsTree(offices).filter(({ office, parent }) => {
    if (!q || matches(office)) return true;
    if (parent) return matches(parent);
    return offices.some((child) => child.parent_office_id === office.id && matches(child));
  });

  const grouped = visible.reduce<Record<string, OfficeTreeEntry<Office>[]>>((acc, entry) => {
    const cat = effectiveCategory(entry.office, offices) || "Other Offices";
    (acc[cat] = acc[cat] || []).push(entry);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 py-5 overflow-hidden">
        <div className="container mx-auto px-4 flex items-center justify-center relative">
          <img src="/usls-oas.png" alt="USLS OASYS" className="h-16 sm:h-20 w-auto" />
          <ThemeToggle className="absolute right-4 top-1/2 -translate-y-1/2" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">University Offices</h1>
            <p className="text-sm text-gray-500 mt-2">
              Find the office you need. Use the search box to filter by office or category.
            </p>
            <p className="text-xs text-gray-400 mt-1.5">
              Offices marked Offline are still being set up and don&apos;t accept OASYS appointments yet.
            </p>
          </div>

          <div className="relative mb-6">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search offices..."
              className="input"
              style={{ paddingLeft: "2.5rem" }}
              autoComplete="off"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-12 text-sm text-gray-400 bg-white border border-gray-100 rounded-xl">No offices match your search.</div>
          ) : (
            Object.entries(grouped).map(([cat, list]) => (
              <section key={cat} className="mb-6">
                <div className="bg-primary text-white rounded-t-xl px-4 py-3">
                  <h2 className="text-sm font-bold uppercase tracking-wide truncate">{cat}</h2>
                </div>
                <div className="bg-white rounded-b-xl border border-t-0 border-gray-200 divide-y divide-gray-100">
                  {list.map(({ office: o, parent }) => (
                    <div key={o.id} className={`py-3.5 flex items-start justify-between gap-4 ${parent ? "pl-8 pr-4 bg-gray-50/60" : "px-4"}`}>
                      <div className="min-w-0">
                        {parent && <p className="text-[10px] text-gray-400 truncate">↳ Under {parent.name}</p>}
                        <p className={`text-sm truncate ${parent ? "font-medium text-gray-800" : "font-semibold text-gray-900"}`}>{o.name}</p>
                        {o.contact_email && <p className="text-xs text-gray-500 mt-0.5 truncate">{o.contact_email}</p>}
                        {o.accepting_appointments === false && (
                          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">{OFFICE_OFFLINE_LABEL}</span>
                            Not accepting OASYS appointments yet. Contact the office directly.
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {o.contact_phone && <p className="text-xs text-gray-600">{o.contact_phone}</p>}
                        <p className="text-[10px] text-gray-400 mt-0.5">{o.operating_hours}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6">
        <div className="container mx-auto px-4 text-center text-xs text-gray-400">
          <p className="space-x-4">
            <Link href="/" className="text-primary hover:underline">Book an Appointment</Link>
            <a href="/privacy" className="text-gray-500 hover:text-primary hover:underline">Privacy Policy</a>
            <a href="/terms" className="text-gray-500 hover:text-primary hover:underline">Terms of Service</a>
          </p>
          <p className="mt-2">&copy; {new Date().getFullYear()} OASYS &mdash; Online Appointment System</p>
        </div>
      </footer>
    </div>
  );
}