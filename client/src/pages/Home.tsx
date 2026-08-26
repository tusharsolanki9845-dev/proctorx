import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowRight, BrainCircuit, CheckCircle2, Download, Eye, FileCheck2, LockKeyhole, ScanFace, ShieldCheck, TimerReset } from "lucide-react";
import { useLocation } from "wouter";

const features = [
  { icon: ScanFace, title: "Local signal layer", copy: "Camera signals are processed in-browser for face presence and multiple-face awareness." },
  { icon: TimerReset, title: "Timed by design", copy: "Server-recorded attempts, automatic timeout submission, and unambiguous completion reasons." },
  { icon: FileCheck2, title: "Auditable outcomes", copy: "Answers, scores, integrity events, and review timelines are retained for authorized review." },
];

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [, setLocation] = useLocation();
  const destination = user?.role === "admin" ? "/admin" : "/dashboard";
  return (
    <div className="min-h-screen overflow-hidden bg-[#05060b]">
      <div className="grid-backdrop pointer-events-none absolute inset-x-0 top-0 h-[760px]" />
      <header className="container relative z-10 flex items-center justify-between py-5">
        <button onClick={() => setLocation("/")} className="flex items-center gap-3 text-left"><span className="grid h-9 w-9 place-items-center border border-cyan-300/75 bg-cyan-300/10 font-display text-xs font-bold text-cyan-100 shadow-[0_0_26px_rgba(34,211,238,.35)]">PX</span><span><span className="font-display text-lg font-bold tracking-tight">PROCTOR<span className="text-pink-400">X</span></span><span className="ml-2 hidden tech-label text-[0.56rem] sm:inline">Assessment OS</span></span></button>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setLocation("/downloads")} className="hidden text-cyan-100 hover:text-pink-300 sm:inline-flex"><Download className="mr-1 h-4 w-4" />Downloads</Button>{isAuthenticated ? <><Button variant="ghost" onClick={logout} className="hidden text-muted-foreground hover:text-pink-300 sm:inline-flex">Sign out</Button><Button onClick={() => setLocation(destination)} className="neon-button bg-pink-400 text-slate-950 hover:bg-pink-300">Open workspace <ArrowRight className="ml-1 h-4 w-4" /></Button></> : <Button onClick={() => setLocation("/signin")} className="neon-button bg-pink-400 text-slate-950 hover:bg-pink-300">Sign in <ArrowRight className="ml-1 h-4 w-4" /></Button>}
        </div>
      </header>

      <main className="relative z-10">
        <section className="container grid gap-12 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pb-28 lg:pt-24">
          <div>
            <div className="mb-6 flex items-center gap-2"><span className="h-2 w-2 bg-cyan-300 shadow-[0_0_16px_#22d3ee] signal-pulse" /><span className="tech-label">Integrity with human context</span></div>
            <h1 className="font-display text-5xl font-bold leading-[.96] tracking-[-0.06em] text-white sm:text-6xl xl:text-7xl">High-trust exams for a <span className="neon-text text-cyan-200">high-signal</span> world.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">ProctorX makes online assessments structured, accountable, and transparent. It pairs focused exam delivery with privacy-conscious browser signals and an audit-ready review trail.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button size="lg" onClick={() => isAuthenticated ? setLocation(destination) : setLocation("/signin")} className="neon-button h-12 bg-pink-400 px-6 text-slate-950 hover:bg-pink-300">{isAuthenticated ? "Enter your workspace" : "Start secure sign in"}<ArrowRight className="ml-2 h-4 w-4" /></Button><Button size="lg" variant="outline" onClick={() => setLocation("/downloads")} className="h-12 border-cyan-200/30 bg-cyan-300/5 text-cyan-100 hover:bg-cyan-300/10 hover:text-cyan-50"><Download className="mr-2 h-4 w-4" />Downloads</Button><Button size="lg" variant="ghost" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })} className="h-12 text-slate-300 hover:text-cyan-100">Explore the system</Button></div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-slate-400"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" />No continuous recording in MVP</span><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-cyan-300" />Human review remains essential</span></div>
          </div>

          <div className="hud-panel scanline overflow-hidden p-5 sm:p-7">
            <div className="flex items-center justify-between border-b border-cyan-200/15 pb-4"><div><p className="tech-label">Live assessment telemetry</p><p className="mt-1 font-display text-lg font-semibold">Session readiness</p></div><span className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 tech-label text-[0.56rem]">Stable</span></div>
            <div className="mt-7 grid grid-cols-[1fr_108px] gap-4 sm:grid-cols-[1fr_148px]">
              <div className="space-y-4"><div className="border-l-2 border-cyan-300 bg-cyan-300/5 p-4"><p className="tech-label">Device check</p><p className="mt-2 text-sm font-medium">Camera permission awaits consent</p><p className="mt-1 text-xs text-muted-foreground">Nothing is activated before the student starts the check.</p></div><div className="border-l-2 border-pink-400 bg-pink-400/5 p-4"><p className="tech-label text-pink-300">Exam logic</p><p className="mt-2 text-sm font-medium">Server-side scoring &amp; submission</p><p className="mt-1 text-xs text-muted-foreground">Correct answers are never delivered during an active attempt.</p></div></div>
              <div className="relative overflow-hidden border border-cyan-200/25 bg-gradient-to-br from-cyan-300/15 via-transparent to-pink-400/15"><div className="absolute inset-4 border border-cyan-200/35" /><div className="absolute left-1/2 top-1/2 h-14 w-12 -translate-x-1/2 -translate-y-1/2 rounded-[48%] border border-cyan-100/70 shadow-[0_0_30px_rgba(34,211,238,.4)]" /><Eye className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-cyan-100" /><div className="absolute bottom-3 left-3 right-3 flex justify-between tech-label text-[0.48rem]"><span>LOCAL</span><span>01</span></div></div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-cyan-200/15 pt-5 text-center"><div><p className="font-display text-xl text-cyan-200">01</p><p className="mt-1 tech-label text-[0.5rem]">Consent</p></div><div><p className="font-display text-xl text-cyan-200">02</p><p className="mt-1 tech-label text-[0.5rem]">Signals</p></div><div><p className="font-display text-xl text-cyan-200">03</p><p className="mt-1 tech-label text-[0.5rem]">Review</p></div></div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-cyan-200/10 bg-[#090a14] py-20"><div className="container"><div className="max-w-2xl"><p className="tech-label">Built for reliable assessment</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">A clear record from launch to review.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3">{features.map(({ icon: Icon, title, copy }, index) => <article key={title} className="hud-panel p-6"><div className="flex items-center justify-between"><Icon className="h-6 w-6 text-cyan-200" /><span className="font-display text-2xl text-pink-300/80">0{index + 1}</span></div><h3 className="mt-9 font-display text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p></article>)}</div></div></section>
        <section className="container grid gap-8 py-20 lg:grid-cols-[.8fr_1.2fr]"><div><p className="tech-label">Trust architecture</p><h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">Protect the exam without pretending technology is perfect.</h2></div><div className="grid gap-3 sm:grid-cols-2">{[[LockKeyhole,"Permission-first monitoring","Camera access begins only after clear student action and contextual notice."],[BrainCircuit,"Assistive, not dispositive","Signals create warnings and timelines; they do not make disciplinary decisions."],[ShieldCheck,"Role-scoped oversight","Students see their own attempts while administrators receive review and export tools."],[ScanFace,"Responsive by default","A focused browser experience is designed to be packaged for PWA or Android wrappers."]].map(([Icon, title, copy]) => { const IconComponent = Icon as typeof LockKeyhole; return <div key={title as string} className="border border-cyan-200/15 bg-white/[.02] p-5"><IconComponent className="h-5 w-5 text-pink-300" /><h3 className="mt-4 font-display font-semibold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{copy as string}</p></div>})}</div></section>
      </main>
      <footer className="container flex flex-col gap-3 border-t border-cyan-200/10 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>ProctorX · Secure assessment with transparent integrity signals.</p><p className="tech-label text-[0.54rem]">Privacy-conscious MVP</p></footer>
    </div>
  );
}
