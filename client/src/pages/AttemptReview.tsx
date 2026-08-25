import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { downloadAdminAttemptReport } from "@/lib/examReportPdf";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, RotateCcw, ShieldAlert } from "lucide-react";
import { useLocation, useRoute } from "wouter";

export default function AttemptReview() {
  const [, params] = useRoute("/admin/attempt/:attemptId");
  const attemptId = Number(params?.attemptId);
  const [, setLocation] = useLocation();
  const review = trpc.proctorx.admin.getAttemptReview.useQuery({ attemptId }, { enabled: Number.isInteger(attemptId) && attemptId > 0 });
  const reopen = trpc.proctorx.admin.reopenAttempt.useMutation({ onSuccess: () => { review.refetch(); }, onError: error => window.alert(error.message) });

  const requestReopen = (basis: "technical_failure" | "approved_accommodation") => {
    const message = basis === "technical_failure" ? "Record the confirmed technical failure before reopening this attempt:" : "Record the approved accommodation basis before reopening this attempt:";
    const note = window.prompt(message);
    if (note?.trim()) reopen.mutate({ attemptId, basis, note: note.trim() });
  };

  if (review.isLoading) return <DashboardLayout><div className="grid min-h-[60vh] place-items-center tech-label">Loading integrity timeline…</div></DashboardLayout>;
  if (!review.data) return <DashboardLayout><div className="hud-panel p-8"><h1 className="font-display text-2xl font-bold">Attempt not found</h1><Button onClick={() => setLocation("/admin")} className="mt-5 bg-cyan-300 text-slate-950">Return to command center</Button></div></DashboardLayout>;

  const { attempt, answers, events } = review.data;
  return <DashboardLayout><div>
    <button onClick={() => setLocation("/admin")} className="flex items-center gap-2 text-sm text-cyan-200 hover:text-cyan-100"><ArrowLeft className="h-4 w-4" />Back to command center</button>
    <div className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="tech-label">Attempt review / #{attempt.id}</p><h1 className="mt-2 font-display text-3xl font-bold">{attempt.examTitle}</h1><p className="mt-2 text-sm text-muted-foreground">{attempt.studentName ?? "Candidate"} · {attempt.studentEmail ?? "No email on record"}</p></div><div className="flex flex-wrap items-end gap-3">{attempt.status !== "in_progress" && <><Button disabled={reopen.isPending} onClick={() => requestReopen("technical_failure")} variant="outline" className="border-cyan-300/30 bg-cyan-300/5 text-cyan-100 hover:bg-cyan-300/10"><RotateCcw className="mr-1 h-4 w-4" />Reopen: technical failure</Button><Button disabled={reopen.isPending} onClick={() => requestReopen("approved_accommodation")} variant="outline" className="border-pink-400/30 bg-pink-400/10 text-pink-100 hover:bg-pink-400/20">Reopen: approved accommodation</Button></>}<Button onClick={() => downloadAdminAttemptReport(review.data)} variant="outline" className="border-pink-400/30 bg-pink-400/10 text-pink-100 hover:bg-pink-400/20">Download PDF report</Button><div className="hud-panel p-4 text-right"><p className="tech-label text-[0.53rem]">Score</p><p className="mt-1 font-display text-2xl text-cyan-100">{attempt.score ?? "—"} / {attempt.maxScore ?? "—"}</p></div></div></div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><section className="hud-panel p-5 sm:p-7"><p className="tech-label">Answer summary</p><div className="mt-5 space-y-3">{answers.map((answer, index) => <div key={answer.questionId} className="border border-cyan-200/12 bg-black/15 p-4"><div className="flex items-start justify-between gap-4"><p className="text-sm leading-6"><span className="mr-2 font-display text-cyan-200">{String(index + 1).padStart(2, "0")}</span>{answer.prompt}</p><span className={`shrink-0 border px-2 py-1 text-xs ${answer.isCorrect ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100" : "border-pink-400/35 bg-pink-400/10 text-pink-200"}`}>{answer.isCorrect ? "Correct" : "Review"}</span></div><p className="mt-3 text-xs text-muted-foreground">Selected: <span className="text-foreground">{answer.selectedOption ?? "No answer"}</span> · Correct: <span className="text-cyan-100">{answer.correctOption}</span>{answer.markedForReview ? " · Flagged by student" : ""}</p></div>)}</div></section><section className="hud-panel p-5 sm:p-7"><div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-pink-300" /><div><p className="tech-label">Integrity timeline</p><p className="mt-1 font-display text-lg font-semibold">{events.length} recorded event(s)</p></div></div><div className="mt-6 border-l border-cyan-200/20 pl-5">{events.length ? events.map(event => <div key={event.id} className="relative pb-6"><span className="absolute -left-[25px] top-1 h-2.5 w-2.5 border border-pink-300 bg-[#0b0c15]" /><p className="font-medium capitalize">{event.eventType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(event.detectedAt).toLocaleString()} · {event.severity} · {event.durationMs}ms</p></div>) : <p className="text-sm leading-6 text-muted-foreground">No integrity events were recorded for this attempt.</p>}</div><div className="border border-pink-400/20 bg-pink-400/5 p-4 text-xs leading-5 text-muted-foreground">Use this timeline as a review aid. Signals require contextual assessment and should not automatically determine misconduct. Reopening an attempt requires a recorded technical-failure or approved-accommodation basis.</div></section></div>
  </div></DashboardLayout>;
}
