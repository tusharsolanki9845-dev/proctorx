import { jsPDF } from "jspdf";

type EventRow = { eventType: string; severity: string; detectedAt: Date; durationMs: number };
type AnswerRow = { prompt: string; selectedOption: string | null; correctOption?: string; isCorrect?: number | null };

function createDocument(title: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  pdf.setFillColor(5, 6, 11); pdf.rect(0, 0, 595, 842, "F");
  pdf.setTextColor(103, 232, 249); pdf.setFont("helvetica", "bold"); pdf.setFontSize(20); pdf.text("PROCTORX", 42, 48);
  pdf.setTextColor(244, 114, 182); pdf.setFontSize(9); pdf.text("ASSESSMENT RECORD", 42, 64);
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(18); pdf.text(title, 42, 102);
  return { pdf, y: 132 };
}

function addLine(document: { pdf: jsPDF; y: number }, label: string, value: string) {
  const { pdf } = document;
  if (document.y > 770) { pdf.addPage(); pdf.setFillColor(5, 6, 11); pdf.rect(0, 0, 595, 842, "F"); document.y = 48; }
  pdf.setTextColor(103, 232, 249); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text(label.toUpperCase(), 42, document.y);
  pdf.setTextColor(225, 231, 235); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  const lines = pdf.splitTextToSize(value || "—", 485); pdf.text(lines, 42, document.y + 16); document.y += 20 + lines.length * 12;
}

export function downloadAdminAttemptReport(review: { attempt: { id: number; examTitle: string; studentName: string | null; studentEmail: string | null; score: number | null; maxScore: number | null; status: string; submissionReason: string | null; integrityRiskScore: number }; answers: AnswerRow[]; events: EventRow[] }) {
  const document = createDocument(`Attempt #${review.attempt.id} report`);
  addLine(document, "Assessment", review.attempt.examTitle); addLine(document, "Candidate", `${review.attempt.studentName ?? "Unknown"} · ${review.attempt.studentEmail ?? "No email"}`); addLine(document, "Outcome", `${review.attempt.score ?? "—"}/${review.attempt.maxScore ?? "—"} · ${review.attempt.status} · ${review.attempt.submissionReason ?? "No submission reason"}`); addLine(document, "Integrity signal count", String(review.attempt.integrityRiskScore));
  addLine(document, "Answer summary", "");
  review.answers.forEach((answer, index) => addLine(document, `Q${index + 1}`, `${answer.prompt}\nSelected: ${answer.selectedOption ?? "No answer"} · Correct: ${answer.correctOption ?? "Restricted"} · ${answer.isCorrect ? "Correct" : "Review"}`));
  addLine(document, "Integrity timeline", "");
  if (!review.events.length) addLine(document, "Event", "No integrity events were recorded.");
  review.events.forEach(event => addLine(document, event.eventType.replaceAll("_", " "), `${new Date(event.detectedAt).toLocaleString()} · ${event.severity} · ${event.durationMs}ms`));
  document.pdf.save(`proctorx-attempt-${review.attempt.id}-report.pdf`);
}

export function downloadStudentAttemptReport(attempt: { id: number; title: string; score: number | null; maxScore: number | null; status: string; submissionReason: string | null; integrityRiskScore: number }, events: EventRow[]) {
  const document = createDocument(`Attempt #${attempt.id} record`);
  addLine(document, "Assessment", attempt.title); addLine(document, "Outcome", `${attempt.score ?? "—"}/${attempt.maxScore ?? "—"} · ${attempt.status} · ${attempt.submissionReason ?? "No submission reason"}`); addLine(document, "Integrity signal count", String(attempt.integrityRiskScore)); addLine(document, "Integrity timeline", "");
  if (!events.length) addLine(document, "Event", "No integrity events were recorded.");
  events.forEach(event => addLine(document, event.eventType.replaceAll("_", " "), `${new Date(event.detectedAt).toLocaleString()} · ${event.severity} · ${event.durationMs}ms`));
  document.pdf.save(`proctorx-attempt-${attempt.id}-record.pdf`);
}
