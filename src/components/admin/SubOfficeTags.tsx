"use client";

import { useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin-fetch";

interface TagState {
  canTag: boolean;
  subOffices: { id: string; name: string; active: boolean }[];
  taggedOfficeIds: string[];
}

// Sub-offices tagged on an appointment. The main office can change the tags; tagged sub-offices see them read-only.
export function SubOfficeTags({ appointmentId }: { appointmentId: string }) {
  const [state, setState] = useState<TagState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminFetch(`/api/appointments/tags?appointmentId=${encodeURIComponent(appointmentId)}`, {})
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TagState | null) => {
        if (cancelled || !data) return;
        setState(data);
        setSelected(data.taggedOfficeIds);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [appointmentId]);

  if (!state || state.subOffices.length === 0) return null;

  const tagged = state.subOffices.filter((office) => state.taggedOfficeIds.includes(office.id));
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...state.taggedOfficeIds].sort());

  const save = async () => {
    setSaving(true); setStatus(null);
    try {
      const res = await adminFetch("/api/appointments/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, officeIds: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not update tagged sub-offices.");
      const added = selected.filter((id) => !state.taggedOfficeIds.includes(id)).length;
      setState({ ...state, taggedOfficeIds: selected });
      setStatus({ type: "success", text: added > 0 ? `Saved. ${added} newly tagged sub-office${added !== 1 ? "s were" : " was"} emailed.` : "Saved." });
    } catch (err) { setStatus({ type: "error", text: err instanceof Error ? err.message : "Could not update tagged sub-offices." }); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="text-xs text-gray-400 mb-1.5">Tagged Sub-offices</div>
      {state.canTag ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
          {state.subOffices.filter((office) => office.active || state.taggedOfficeIds.includes(office.id)).map((office) => (
            <label key={office.id} className="flex items-center gap-2.5 text-sm text-gray-800 cursor-pointer">
              <input type="checkbox" checked={selected.includes(office.id)} className="w-4 h-4 rounded border-gray-300 accent-[#006633]"
                onChange={() => setSelected((prev) => prev.includes(office.id) ? prev.filter((id) => id !== office.id) : [...prev, office.id])} />
              {office.name}
            </label>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={save} disabled={!dirty || saving} className="btn-secondary btn-sm text-xs disabled:opacity-50">
              {saving ? "Saving..." : "Save tags"}
            </button>
            {status && <span className={`text-xs ${status.type === "error" ? "text-red-600" : "text-green-700"}`}>{status.text}</span>}
          </div>
          <p className="text-[11px] text-gray-400">Newly tagged sub-offices are emailed and can see and act on this appointment.</p>
        </div>
      ) : (
        <div className="text-sm font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-lg p-3">
          {tagged.length > 0 ? tagged.map((office) => office.name).join(", ") : "None"}
        </div>
      )}
    </div>
  );
}
