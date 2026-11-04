import type { Metadata } from "next";
import Link from "next/link";
import { HelpShell } from "@/components/help/HelpShell";
import { createServiceClient } from "@/lib/supabase/server";
import { getViewerRole, type ViewerRole } from "@/lib/viewer";
import { parseSystemAlertAudience, type SystemAlertAudience } from "@/lib/system-alert";
import type { SystemUpdate } from "@/types/database";

export const metadata: Metadata = {
  title: "Updates",
  description: "What's new in the USLS Online Appointment System.",
};

// Depends on who is signed in, so it can't be cached.
export const dynamic = "force-dynamic";

const AUDIENCE_LABELS: Record<SystemAlertAudience, string> = { landing: "Visitors", admin: "Office admins", gate: "Guards" };

// Which popup audiences each viewer may read. Super admins see everything.
function visibleAudiences(role: ViewerRole): SystemAlertAudience[] {
  if (role === "super_admin") return ["landing", "admin", "gate"];
  if (role === "office_admin") return ["landing", "admin"];
  if (role === "gate_user" || role === "gate_admin") return ["landing", "gate"];
  return ["landing"];
}

async function loadUpdates(): Promise<SystemUpdate[] | null> {
  const { data, error } = await createServiceClient()
    .from("system_updates")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(100);
  return error ? null : (data || []);
}

export default async function UpdatesPage() {
  const role = await getViewerRole();
  const allowed = visibleAudiences(role);
  const all = await loadUpdates();
  const updates = (all || []).filter((u) => parseSystemAlertAudience(u.audience).some((a) => allowed.includes(a)));

  return (
    <HelpShell active="updates" role={role}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">What&apos;s new</h1>
          <p className="text-sm text-gray-500 mt-1">Changes and new features in OASYS, newest first. These match the update popups shown in the system.</p>
        </div>

        {!role && (
          <div className="p-3 rounded-lg bg-white border border-gray-200 text-xs text-gray-600">
            Staff updates are shown after you sign in.{" "}
            <Link href="/admin/login?next=/updates" className="text-primary font-medium hover:underline">Office admin sign in</Link>
            {" · "}
            <Link href="/entry?next=/updates" className="text-primary font-medium hover:underline">Guard sign in</Link>
          </div>
        )}

        {all === null ? (
          <div className="card text-sm text-gray-500 text-center">Updates aren&apos;t available right now. Please check back later.</div>
        ) : updates.length === 0 ? (
          <div className="card text-sm text-gray-500 text-center">No updates yet.</div>
        ) : (
          <ol className="relative border-l-2 border-primary/15 ml-2 space-y-6">
            {updates.map((update) => {
              const audiences = parseSystemAlertAudience(update.audience);
              return (
                <li key={update.id} className="pl-6 relative">
                  <span className="absolute -left-[9px] top-5 w-4 h-4 rounded-full bg-white border-4 border-primary" aria-hidden="true" />
                  <article className="card !p-5 sm:!p-6">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <time dateTime={update.published_at} className="text-xs font-medium text-primary">
                        {new Date(update.published_at).toLocaleDateString("en-US", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" })}
                      </time>
                      {role && audiences.map((a) => (
                        <span key={a} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">{AUDIENCE_LABELS[a]}</span>
                      ))}
                    </div>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900 break-words">{update.headline}</h2>
                    {update.message && (
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed whitespace-pre-line break-words">{update.message}</p>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </HelpShell>
  );
}
