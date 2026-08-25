import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AdminNotifications } from "@/components/AdminNotifications";
import { BarChart3, ClipboardList, Headphones, LayoutDashboard, LogOut, ShieldCheck, UsersRound } from "lucide-react";
import { useLocation } from "wouter";

const menuItems = [
  { icon: LayoutDashboard, label: "Command center", path: "/admin" },
  { icon: ClipboardList, label: "Exam registry", path: "/admin" },
  { icon: BarChart3, label: "Results archive", path: "/admin/results" },
  { icon: Headphones, label: "Support desk", path: "/admin/support" },
  { icon: UsersRound, label: "Identity directory", path: "/admin/identities" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (loading) return <div className="min-h-screen grid place-items-center tech-label">Loading secure workspace…</div>;
  if (!user) {
    return (
      <div className="grid-backdrop min-h-screen grid place-items-center p-6">
        <div className="hud-panel max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto mb-5 h-10 w-10 text-cyan-300" />
          <p className="tech-label">Access control</p>
          <h1 className="mt-2 text-3xl font-semibold">Sign in to continue</h1>
          <p className="mt-3 text-sm text-muted-foreground">Administrator controls are available only to approved accounts.</p>
          <Button onClick={() => setLocation("/signin")} className="neon-button mt-7 w-full bg-pink-400 text-slate-950 hover:bg-pink-300">Authenticate</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="border-b border-cyan-200/15 bg-[#080916]/95 lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="grid h-9 w-9 place-items-center border border-cyan-300/70 bg-cyan-300/10 text-sm font-bold text-cyan-200 shadow-[0_0_22px_rgba(34,211,238,.28)]">PX</div>
          <div><p className="font-display font-bold tracking-tight">PROCTOR<span className="text-pink-400">X</span></p><p className="tech-label text-[0.54rem]">Admin terminal</p></div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:px-4">
          {menuItems.map(item => {
            const active = location === item.path || (item.path === "/admin" && location.startsWith("/admin/attempt"));
            return <button key={item.label} onClick={() => setLocation(item.path)} className={`flex shrink-0 items-center gap-3 px-3 py-2.5 text-sm transition-colors lg:w-full ${active ? "border border-cyan-300/30 bg-cyan-300/10 text-cyan-100" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"}`}><item.icon className="h-4 w-4" />{item.label}</button>;
          })}
        </nav>
        <div className="hidden lg:block lg:absolute lg:bottom-0 lg:w-[264px] lg:p-4">
          <div className="hud-panel flex items-center gap-3 p-3">
            <Avatar className="h-9 w-9 border border-pink-300/30"><AvatarFallback className="bg-pink-400/10 text-pink-200">{user.name?.slice(0, 1).toUpperCase() ?? "A"}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user.name ?? "Administrator"}</p><p className="tech-label truncate text-[0.52rem]">Authorized</p></div>
            <button onClick={logout} title="Sign out" className="text-muted-foreground hover:text-pink-300"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </aside>
      <div className="relative min-w-0">{user.role === "admin" && <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6 lg:right-9 lg:top-9"><AdminNotifications /></div>}<main className="min-w-0 p-4 pt-16 sm:p-6 sm:pt-20 lg:p-9 lg:pt-24">{children}</main></div>
    </div>
  );
}
