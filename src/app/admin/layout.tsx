"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Admin } from "@/types/database";

const PUBLIC_ADMIN_ROUTES = ["/admin/login"];

interface AdminContextType {
  user: User;
  admin: Admin & { offices?: { name: string } | null };
}

export const AdminContext = createContext<AdminContextType | null>(null);

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminLayout");
  return ctx;
}

function SidebarLink({ href, label, icon, active, onClick }: { href: string; label: string; icon: string; active: boolean; onClick?: () => void }) {
  return (
    <a href={href} onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
        active ? "bg-primary/10 text-primary" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
      }`}>
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
      </svg>
      {label}
    </a>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<(Admin & { offices?: { name: string } | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const isPublicRoute = PUBLIC_ADMIN_ROUTES.includes(pathname);

  const checkUser = async () => {
    if (isPublicRoute) { setLoading(false); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/admin/login"); return; }
      const authResponse = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!authResponse.ok) { router.push("/admin/login"); return; }
      const { admin: adminData } = await authResponse.json();
      setUser(user);
      setAdmin(adminData);
    } catch { router.push("/admin/login"); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { checkUser(); }, [pathname]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/admin/login"); };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="relative mx-auto w-10 h-10 mb-3">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200" />
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (isPublicRoute) return <>{children}</>;
  if (!user || !admin) return null;

  const isSuperAdmin = admin.role === "super_admin";
  const navItems = [
    { href: "/admin", label: "Appointments", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    ...(isSuperAdmin ? [
      { href: "/admin/offices", label: "Offices", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
      { href: "/admin/accounts", label: "Accounts", icon: "M12 4.354a4 4 0 110 7.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
      { href: "/admin/audit", label: "Audit Log", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
    ] : []),
  ];

  return (
    <AdminContext.Provider value={{ user, admin }}>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200 z-30">
          <div className="flex items-center justify-center px-5 py-5 border-b border-gray-100 flex-shrink-0">
            <img src="/oas.svg" alt="USLS OAS" className="h-12 w-auto" />
          </div>
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <SidebarLink key={item.href} {...item} active={pathname === item.href} />
            ))}
          </nav>
          <div className="border-t border-gray-100 p-3">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{(admin.name || user.email || "?")[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate">{admin.name || user.email}</div>
                <div className="text-xs text-gray-400 truncate">{isSuperAdmin ? "Super Admin" : admin.offices?.name || "Office Admin"}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-72 h-full bg-white shadow-xl animate-fade-in">
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
                <div className="flex items-center justify-center">
            <img src="/oas.svg" alt="USLS OAS" className="h-10 w-auto" />
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="px-3 py-4 space-y-1">
                {navItems.map((item) => (
                  <SidebarLink key={item.href} {...item} active={pathname === item.href} onClick={() => setSidebarOpen(false)} />
                ))}
              </nav>
              <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 p-3 bg-white">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-primary">{(admin.name || user.email || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 truncate">{admin.name || user.email}</div>
                    <div className="text-xs text-gray-400 truncate">{isSuperAdmin ? "Super Admin" : admin.offices?.name || "Office Admin"}</div>
                  </div>
                </div>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 mt-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
          {/* Mobile top bar */}
          <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-20 h-14 flex items-center px-4 gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <img src="/oas.svg" alt="USLS OAS" className="h-8 w-auto" />
            </div>
          </header>
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
