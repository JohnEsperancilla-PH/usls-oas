import type { Metadata } from "next";
import Link from "next/link";
import { HelpShell } from "@/components/help/HelpShell";
import { GuardGuide, OfficeAdminGuide, SuperAdminGuide, VisitorGuide } from "@/components/help/GuideContent";
import { getViewerRole, type ViewerRole } from "@/lib/viewer";
import { getEntryWindow } from "@/lib/entry-window-server";

export const metadata: Metadata = {
  title: "Guide",
  description: "How to book a campus appointment, and how office admins and guards use OASYS.",
};

// Which guides are shown depends on who is signed in.
export const dynamic = "force-dynamic";

type GuideKey = "visitors" | "office" | "guards" | "super";

const GUIDES: { key: GuideKey; label: string; title: string; roles: Exclude<ViewerRole, null>[] | null; signIn?: string }[] = [
  { key: "visitors", label: "Visitors", title: "Visitor guide", roles: null },
  { key: "office", label: "Office admins", title: "Office admin guide", roles: ["office_admin", "super_admin"], signIn: "/admin/login" },
  { key: "guards", label: "Guards", title: "Guard guide", roles: ["gate_user", "gate_admin", "super_admin"], signIn: "/entry" },
  { key: "super", label: "Super admins", title: "Super admin guide", roles: ["super_admin"], signIn: "/admin/login" },
];

function canView(guide: (typeof GUIDES)[number], role: ViewerRole) {
  return guide.roles === null || (role !== null && guide.roles.includes(role));
}

// Staff land on their own guide; visitors on the visitor guide.
function defaultGuide(role: ViewerRole): GuideKey {
  return role === "office_admin" ? "office" : role === "gate_user" || role === "gate_admin" ? "guards" : "visitors";
}

function LockedGuide({ guide, role }: { guide: (typeof GUIDES)[number]; role: ViewerRole }) {
  const next = encodeURIComponent(`/guide?for=${guide.key}`);
  return (
    <div className="text-center py-10 px-4">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{guide.title}</h2>
      {role ? (
        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">Your account doesn&apos;t have access to this guide. Pick the guide for your role above.</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            {guide.key === "guards" ? "Sign in with your guard account to read this guide." : "Sign in with your admin account to read this guide."}
          </p>
          <Link href={`${guide.signIn}?next=${next}`} className="btn-primary btn-sm inline-block mt-4">
            {guide.key === "guards" ? "Guard sign in" : "Admin sign in"}
          </Link>
        </>
      )}
    </div>
  );
}

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const [role, params, entryWindow] = await Promise.all([getViewerRole(), searchParams, getEntryWindow()]);
  // The super admin tab is only listed for super admins.
  const tabs = GUIDES.filter((g) => g.key !== "super" || role === "super_admin");
  const current = tabs.find((g) => g.key === params.for) ?? tabs.find((g) => g.key === defaultGuide(role))!;
  const allowed = canView(current, role);

  return (
    <HelpShell active="guide" role={role}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">How to use OASYS</h1>
          <p className="text-sm text-gray-500 mt-1">Step-by-step help for visitors, office admins, and guards.</p>
        </div>

        <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Guides">
          {tabs.map((tab) => {
            const locked = !canView(tab, role);
            const active = tab.key === current.key;
            return (
              <Link key={tab.key} href={`/guide?for=${tab.key}`} aria-current={active ? "page" : undefined}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${active ? "bg-primary text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
                {tab.label}
                {locked && (
                  <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="sign-in required">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </Link>
            );
          })}
        </nav>

        <article className="card p-6 sm:p-10">
          {allowed ? (
            <>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">{current.title}</h2>
              <div className="legal-content">
                {current.key === "visitors" && <VisitorGuide entryWindow={entryWindow} />}
                {current.key === "office" && <OfficeAdminGuide />}
                {current.key === "guards" && <GuardGuide entryWindow={entryWindow} showGuardAdmin={role === "gate_admin" || role === "super_admin"} />}
                {current.key === "super" && <SuperAdminGuide />}
              </div>
            </>
          ) : (
            <LockedGuide guide={current} role={role} />
          )}
        </article>

        <p className="text-center text-xs text-gray-400">
          See what&apos;s changed recently on the <Link href="/updates" className="text-primary hover:underline">Updates</Link> page.
        </p>
      </div>
    </HelpShell>
  );
}
