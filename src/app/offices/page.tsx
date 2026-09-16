"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Office } from "@/types/database";

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

  const visible = offices.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return o.name.toLowerCase().includes(q) || (o.category || "").toLowerCase().includes(q);
  });

  const grouped = visible.reduce<Record<string, Office[]>>((acc, o) => {
    const cat = o.category || "Other Offices";
    (acc[cat] = acc[cat] || []).push(o);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 py-5 overflow-hidden">
        <div className="container mx-auto px-4 flex items-center justify-center">
          <img src="/usls-oas.png" alt="USLS OASYS" className="h-16 sm:h-20 w-auto" />
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
              Only the offices listed below accept OASYS appointments.
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
                  {list.map((o) => (
                    <div key={o.id} className="px-4 py-3.5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{o.name}</p>
                        {o.contact_email && <p className="text-xs text-gray-500 mt-0.5 truncate">{o.contact_email}</p>}
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