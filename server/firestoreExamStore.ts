import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { calculateExamScore, normalizeProctoringConfig, type AnswerOption } from "../shared/proctoring";
import { canAccessAttemptReport, canSendSupportMessage } from "../shared/accessControl";
import { getFirebaseFirestore } from "./firebaseAdmin";

type ExamStatus = "draft" | "scheduled" | "live" | "closed" | "archived";
type AttemptStatus = "in_progress" | "submitted" | "reviewed" | "invalidated";
type SubmissionReason = "manual" | "timeout" | "integrity_threshold" | "admin_action";
type Severity = "info" | "warning" | "critical";

const asDate = (value: Timestamp | Date | null | undefined) => !value ? null : value instanceof Timestamp ? value.toDate() : value;
const timestamp = (value: Date | null | undefined) => value ? Timestamp.fromDate(value) : null;
const asBoolNumber = (value: boolean) => value ? 1 : 0;

async function nextIdInTransaction(entity: string, transaction: FirebaseFirestore.Transaction) {
  const db = getFirebaseFirestore();
  const counter = db.collection("meta").doc("counters");
  const snapshot = await transaction.get(counter);
  const id = Number(snapshot.data()?.[entity] ?? 0) + 1;
  transaction.set(counter, { [entity]: id }, { merge: true });
  return id;
}

async function nextId(entity: string) {
  return getFirebaseFirestore().runTransaction(transaction => nextIdInTransaction(entity, transaction));
}

function presentExam(data: Record<string, any>): Record<string, any> & { startsAt: Date | null; endsAt: Date | null; createdAt: Date | null; updatedAt: Date | null } {
  return { ...data, startsAt: asDate(data.startsAt), endsAt: asDate(data.endsAt), createdAt: asDate(data.createdAt), updatedAt: asDate(data.updatedAt) };
}

function presentAttempt(data: Record<string, any>): Record<string, any> & { startedAt: Date | null; submittedAt: Date | null; lastActivityAt: Date | null } {
  return { ...data, startedAt: asDate(data.startedAt), submittedAt: asDate(data.submittedAt), lastActivityAt: asDate(data.lastActivityAt) };
}

async function getAttemptOwner(attemptId: number) {
  const snapshot = await getFirebaseFirestore().collection("attempts").doc(String(attemptId)).get();
  return snapshot.exists ? presentAttempt(snapshot.data() as Record<string, any>) : null;
}

export async function getStudentOverview(userId: number) {
  const db = getFirebaseFirestore();
  const [user, examSnapshot, attemptSnapshot] = await Promise.all([
    db.collection("users").doc(String(userId)).get(),
    db.collection("exams").get(),
    db.collection("attempts").where("userId", "==", userId).get(),
  ]);
  const profile = user.exists && user.data()?.profile
    ? { id: userId, userId, ...user.data()!.profile, createdAt: asDate(user.data()!.createdAt)!, updatedAt: asDate(user.data()!.updatedAt)! }
    : null;
  const availableExams = examSnapshot.docs
    .map(doc => presentExam(doc.data()))
    .filter(exam => exam.status === "scheduled" || exam.status === "live")
    .sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0))
    .slice(0, 30)
    .map(exam => ({ id: exam.id, title: exam.title, description: exam.description, durationSeconds: exam.durationSeconds, startsAt: exam.startsAt, endsAt: exam.endsAt, status: exam.status, proctoringConfig: exam.proctoringConfig }));
  const examMap = new Map(examSnapshot.docs.map(doc => [Number(doc.id), presentExam(doc.data())]));
  const attempts = attemptSnapshot.docs
    .map(doc => presentAttempt(doc.data()))
    .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))
    .slice(0, 30)
    .map(attempt => {
      const exam = examMap.get(attempt.examId);
      return { ...attempt, examTitle: exam?.title ?? "Assessment", releaseResultsImmediately: exam?.releaseResultsImmediately ?? 0 };
    });
  return { profile, availableExams, attempts };
}

export async function startExamAttempt(userId: number, examId: number) {
  const db = getFirebaseFirestore();
  const examRef = db.collection("exams").doc(String(examId));
  return db.runTransaction(async transaction => {
    const examSnapshot = await transaction.get(examRef);
    if (!examSnapshot.exists) throw new Error("This exam is not available.");
    const exam = presentExam(examSnapshot.data() as Record<string, any>);
    if (!["scheduled", "live"].includes(exam.status)) throw new Error("This exam is not available.");
    const now = new Date();
    if ((exam.startsAt && exam.startsAt > now) || (exam.endsAt && exam.endsAt < now)) throw new Error("This exam is outside its scheduled window.");
    const existing = await transaction.get(db.collection("attempts").where("userId", "==", userId));
    const attempts = existing.docs.map(doc => presentAttempt(doc.data())).filter(attempt => attempt.examId === examId);
    const active = attempts.find(attempt => attempt.status === "in_progress");
    if (active) return { id: active.id };
    if (attempts.length >= Number(exam.maxAttempts ?? 1)) throw new Error("The maximum number of attempts has been reached.");
    const id = await nextIdInTransaction("attempts", transaction);
    const nowTimestamp = Timestamp.now();
    transaction.create(db.collection("attempts").doc(String(id)), { id, examId, userId, status: "in_progress", startedAt: nowTimestamp, submittedAt: null, submissionReason: null, score: null, maxScore: null, integrityRiskScore: 0, lastActivityAt: nowTimestamp });
    return { id };
  });
}

export async function getStudentAttempt(userId: number, attemptId: number) {
  const db = getFirebaseFirestore();
  const attemptSnapshot = await db.collection("attempts").doc(String(attemptId)).get();
  if (!attemptSnapshot.exists) return null;
  const attempt = presentAttempt(attemptSnapshot.data() as Record<string, any>);
  if (attempt.userId !== userId) return null;
  const [examSnapshot, questions, answers, events] = await Promise.all([
    db.collection("exams").doc(String(attempt.examId)).get(),
    db.collection("exams").doc(String(attempt.examId)).collection("questions").get(),
    db.collection("attempts").doc(String(attemptId)).collection("answers").get(),
    db.collection("attempts").doc(String(attemptId)).collection("events").get(),
  ]);
  if (!examSnapshot.exists) return null;
  const exam = presentExam(examSnapshot.data() as Record<string, any>);
  const safeQuestions = questions.docs.map(doc => doc.data()).sort((a, b) => a.orderIndex - b.orderIndex).map(question => ({ id: question.id, prompt: question.prompt, optionA: question.optionA, optionB: question.optionB, optionC: question.optionC, optionD: question.optionD, points: question.points, orderIndex: question.orderIndex }));
  return {
    attempt: { ...attempt, title: exam.title, description: exam.description, durationSeconds: exam.durationSeconds, endsAt: exam.endsAt, releaseResultsImmediately: exam.releaseResultsImmediately, proctoringConfig: exam.proctoringConfig },
    questions: safeQuestions,
    answers: answers.docs.map(doc => ({ ...doc.data(), answeredAt: asDate(doc.data().answeredAt) })),
    events: events.docs.map(doc => ({ ...doc.data(), detectedAt: asDate(doc.data().detectedAt) })).sort((a, b) => (b.detectedAt?.getTime() ?? 0) - (a.detectedAt?.getTime() ?? 0)),
  };
}

export async function saveAttemptAnswer(userId: number, input: { attemptId: number; questionId: number; selectedOption: AnswerOption | null; markedForReview: boolean }) {
  const db = getFirebaseFirestore();
  const attemptRef = db.collection("attempts").doc(String(input.attemptId));
  await db.runTransaction(async transaction => {
    const attemptSnapshot = await transaction.get(attemptRef);
    if (!attemptSnapshot.exists) throw new Error("This exam attempt is no longer editable.");
    const attempt = presentAttempt(attemptSnapshot.data() as Record<string, any>);
    if (attempt.userId !== userId || attempt.status !== "in_progress") throw new Error("This exam attempt is no longer editable.");
    const question = await transaction.get(db.collection("exams").doc(String(attempt.examId)).collection("questions").doc(String(input.questionId)));
    if (!question.exists) throw new Error("The selected question does not belong to this exam.");
    transaction.set(attemptRef.collection("answers").doc(String(input.questionId)), { id: input.questionId, attemptId: input.attemptId, questionId: input.questionId, selectedOption: input.selectedOption, markedForReview: asBoolNumber(input.markedForReview), isCorrect: null, answeredAt: input.selectedOption ? Timestamp.now() : null }, { merge: true });
    transaction.update(attemptRef, { lastActivityAt: Timestamp.now() });
  });
  return { success: true };
}

export async function submitExamAttempt(userId: number, attemptId: number, reason: SubmissionReason) {
  const db = getFirebaseFirestore();
  const attemptRef = db.collection("attempts").doc(String(attemptId));
  return db.runTransaction(async transaction => {
    const attemptSnapshot = await transaction.get(attemptRef);
    if (!attemptSnapshot.exists) throw new Error("Exam attempt was not found.");
    const attempt = presentAttempt(attemptSnapshot.data() as Record<string, any>);
    if (attempt.userId !== userId) throw new Error("Exam attempt was not found.");
    if (attempt.status !== "in_progress") return { id: attemptId, score: attempt.score, maxScore: attempt.maxScore, reason: attempt.submissionReason };
    const [questionSnapshot, answerSnapshot] = await Promise.all([
      transaction.get(db.collection("exams").doc(String(attempt.examId)).collection("questions")),
      transaction.get(attemptRef.collection("answers")),
    ]);
    const questions = questionSnapshot.docs.map(doc => doc.data());
    const answers = new Map(answerSnapshot.docs.map(doc => [Number(doc.data().questionId), doc.data().selectedOption as AnswerOption | null]));
    const result = calculateExamScore(questions.map(question => ({ id: question.id, correctOption: question.correctOption as AnswerOption, points: question.points })), answers);
    for (const answer of answerSnapshot.docs) {
      const question = questions.find(row => row.id === answer.data().questionId);
      transaction.update(answer.ref, { isCorrect: question && answer.data().selectedOption === question.correctOption ? 1 : 0 });
    }
    transaction.update(attemptRef, { status: "submitted", submittedAt: Timestamp.now(), submissionReason: reason, score: result.score, maxScore: result.maxScore, lastActivityAt: Timestamp.now() });
    return { id: attemptId, ...result, reason };
  });
}

export async function recordProctoringEvent(userId: number, input: { attemptId: number; eventType: string; durationMs: number; metadata?: Record<string, unknown> }) {
  const db = getFirebaseFirestore();
  const attemptRef = db.collection("attempts").doc(String(input.attemptId));
  return db.runTransaction(async transaction => {
    const attemptSnapshot = await transaction.get(attemptRef);
    if (!attemptSnapshot.exists) throw new Error("This exam attempt is not accepting integrity events.");
    const attempt = presentAttempt(attemptSnapshot.data() as Record<string, any>);
    if (attempt.userId !== userId || attempt.status !== "in_progress") throw new Error("This exam attempt is not accepting integrity events.");
    const exam = await transaction.get(db.collection("exams").doc(String(attempt.examId)));
    const config = normalizeProctoringConfig(exam.data()?.proctoringConfig);
    const events = await transaction.get(attemptRef.collection("events"));
    const eventCount = events.size + 1;
    const severity: Severity = eventCount >= config.autoSubmitEventCount ? "critical" : eventCount >= config.warningEventCount ? "warning" : "info";
    const eventRef = attemptRef.collection("events").doc();
    transaction.create(eventRef, { id: eventRef.id, attemptId: input.attemptId, eventType: input.eventType, severity, detectedAt: Timestamp.now(), durationMs: input.durationMs, metadata: input.metadata ?? null, resolvedAt: null });
    transaction.update(attemptRef, { integrityRiskScore: eventCount, lastActivityAt: Timestamp.now() });
    return { eventCount, proctoringConfig: config };
  });
}

export async function writeAuditLog(actorUserId: number, action: string, entityType: string, entityId: number | null, metadata?: Record<string, unknown>) {
  await getFirebaseFirestore().collection("auditLogs").add({ actorUserId, action, entityType, entityId, metadata: metadata ?? null, createdAt: Timestamp.now() });
}

export async function listAdminExams() {
  const snapshot = await getFirebaseFirestore().collection("exams").get();
  return snapshot.docs.map(doc => presentExam(doc.data())).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).map(exam => ({ id: exam.id, title: exam.title, description: exam.description, durationSeconds: exam.durationSeconds, startsAt: exam.startsAt, endsAt: exam.endsAt, status: exam.status, maxAttempts: exam.maxAttempts, createdAt: exam.createdAt }));
}

export async function getAdminExam(examId: number) {
  const db = getFirebaseFirestore();
  const [examSnapshot, questionSnapshot] = await Promise.all([db.collection("exams").doc(String(examId)).get(), db.collection("exams").doc(String(examId)).collection("questions").get()]);
  if (!examSnapshot.exists) return null;
  const questionRows: Array<Record<string, any>> = questionSnapshot.docs.map(doc => doc.data() as Record<string, any>);
  const questions: Array<Record<string, any>> = questionRows.map(question => ({ ...question, createdAt: asDate(question.createdAt), updatedAt: asDate(question.updatedAt) }));
  questions.sort((a, b) => Number(a.orderIndex) - Number(b.orderIndex));
  return { exam: presentExam(examSnapshot.data() as Record<string, any>), questions };
}

export async function createExam(adminUserId: number, input: { title: string; description?: string | null; durationSeconds: number; startsAt?: Date | null; endsAt?: Date | null; status: ExamStatus; maxAttempts: number; shuffleQuestions: boolean; releaseResultsImmediately: boolean; proctoringConfig: Record<string, unknown>; questions: Array<{ prompt: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: AnswerOption; points: number }> }) {
  const db = getFirebaseFirestore();
  const id = await nextId("exams");
  const now = Timestamp.now();
  const batch = db.batch();
  batch.create(db.collection("exams").doc(String(id)), { id, createdByUserId: adminUserId, title: input.title, description: input.description ?? null, durationSeconds: input.durationSeconds, startsAt: timestamp(input.startsAt), endsAt: timestamp(input.endsAt), status: input.status, maxAttempts: input.maxAttempts, shuffleQuestions: asBoolNumber(input.shuffleQuestions), releaseResultsImmediately: asBoolNumber(input.releaseResultsImmediately), proctoringConfig: normalizeProctoringConfig(input.proctoringConfig), createdAt: now, updatedAt: now });
  for (let index = 0; index < input.questions.length; index += 1) {
    const question = input.questions[index]!;
    const questionId = await nextId("questions");
    batch.create(db.collection("exams").doc(String(id)).collection("questions").doc(String(questionId)), { id: questionId, examId: id, ...question, orderIndex: index, createdAt: now, updatedAt: now });
  }
  await batch.commit();
  await writeAuditLog(adminUserId, "exam.created", "exam", id, { questionCount: input.questions.length });
  return { id };
}

export async function updateExam(adminUserId: number, examId: number, input: { title: string; description?: string | null; durationSeconds: number; startsAt?: Date | null; endsAt?: Date | null; status: ExamStatus; maxAttempts: number; shuffleQuestions: boolean; releaseResultsImmediately: boolean; proctoringConfig: Record<string, unknown>; questions: Array<{ prompt: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: AnswerOption; points: number }> }) {
  const db = getFirebaseFirestore();
  const examRef = db.collection("exams").doc(String(examId));
  const [examSnapshot, attemptSnapshot, existingQuestions] = await Promise.all([examRef.get(), db.collection("attempts").where("examId", "==", examId).get(), examRef.collection("questions").get()]);
  if (!examSnapshot.exists) throw new Error("Assessment was not found.");
  if (!attemptSnapshot.empty) throw new Error("Assessments with recorded attempts cannot have their questions or settings changed.");
  const batch = db.batch();
  batch.update(examRef, { title: input.title, description: input.description ?? null, durationSeconds: input.durationSeconds, startsAt: timestamp(input.startsAt), endsAt: timestamp(input.endsAt), status: input.status, maxAttempts: input.maxAttempts, shuffleQuestions: asBoolNumber(input.shuffleQuestions), releaseResultsImmediately: asBoolNumber(input.releaseResultsImmediately), proctoringConfig: normalizeProctoringConfig(input.proctoringConfig), updatedAt: Timestamp.now() });
  existingQuestions.docs.forEach(question => batch.delete(question.ref));
  for (let index = 0; index < input.questions.length; index += 1) {
    const question = input.questions[index]!;
    const questionId = await nextId("questions");
    batch.create(examRef.collection("questions").doc(String(questionId)), { id: questionId, examId, ...question, orderIndex: index, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  }
  await batch.commit();
  await writeAuditLog(adminUserId, "exam.updated", "exam", examId, { questionCount: input.questions.length });
  return { id: examId };
}

export async function reopenExamAttempt(adminUserId: number, attemptId: number, basis: "technical_failure" | "approved_accommodation", note: string) {
  const db = getFirebaseFirestore();
  const ref = db.collection("attempts").doc(String(attemptId));
  const [attemptSnapshot, events] = await Promise.all([ref.get(), ref.collection("events").get()]);
  if (!attemptSnapshot.exists) throw new Error("Exam attempt was not found.");
  const attempt = presentAttempt(attemptSnapshot.data() as Record<string, any>);
  if (attempt.status === "in_progress") throw new Error("This attempt is already active.");
  const batch = db.batch();
  events.docs.forEach(event => batch.delete(event.ref));
  batch.update(ref, { status: "in_progress", startedAt: Timestamp.now(), submittedAt: null, submissionReason: null, score: null, maxScore: null, integrityRiskScore: 0, lastActivityAt: Timestamp.now() });
  await batch.commit();
  await writeAuditLog(adminUserId, "attempt.reopened", "examAttempt", attemptId, { basis, note, clearedIntegrityEventCount: events.size });
  return { id: attemptId, status: "in_progress" as const };
}

export async function getAttemptReview(attemptId: number) {
  const db = getFirebaseFirestore();
  const attemptSnapshot = await db.collection("attempts").doc(String(attemptId)).get();
  if (!attemptSnapshot.exists) return null;
  const attempt = presentAttempt(attemptSnapshot.data() as Record<string, any>);
  const [examSnapshot, userSnapshot, questions, answers, events] = await Promise.all([db.collection("exams").doc(String(attempt.examId)).get(), db.collection("users").doc(String(attempt.userId)).get(), db.collection("exams").doc(String(attempt.examId)).collection("questions").get(), db.collection("attempts").doc(String(attemptId)).collection("answers").get(), db.collection("attempts").doc(String(attemptId)).collection("events").get()]);
  if (!examSnapshot.exists || !userSnapshot.exists) return null;
  const exam = presentExam(examSnapshot.data() as Record<string, any>);
  const user = userSnapshot.data()!;
  const answerMap = new Map(answers.docs.map(doc => [Number(doc.data().questionId), doc.data()]));
  return { attempt: { ...attempt, examTitle: exam.title, studentName: user.name, studentEmail: user.email, rollNumber: user.profile?.rollNumber ?? null, collegeName: user.profile?.collegeName ?? null }, answers: questions.docs.map(doc => { const question = doc.data(); const answer = answerMap.get(question.id); return { questionId: question.id, prompt: question.prompt, selectedOption: answer?.selectedOption ?? null, correctOption: question.correctOption, isCorrect: answer?.isCorrect ?? null, markedForReview: answer?.markedForReview ?? 0 }; }).sort((a, b) => a.questionId - b.questionId), events: events.docs.map(doc => ({ ...doc.data(), detectedAt: asDate(doc.data().detectedAt) })).sort((a, b) => (b.detectedAt?.getTime() ?? 0) - (a.detectedAt?.getTime() ?? 0)) };
}

export async function getResultsExport() {
  const db = getFirebaseFirestore();
  const [attempts, exams, users] = await Promise.all([db.collection("attempts").get(), db.collection("exams").get(), db.collection("users").get()]);
  const examMap = new Map(exams.docs.map(doc => [Number(doc.id), presentExam(doc.data())]));
  const userMap = new Map(users.docs.map(doc => [Number(doc.id), doc.data()]));
  return attempts.docs.map(doc => presentAttempt(doc.data() as Record<string, any>)).map(attempt => ({ attemptId: attempt.id, examTitle: examMap.get(attempt.examId)?.title ?? "Assessment", studentName: userMap.get(attempt.userId)?.name ?? null, studentEmail: userMap.get(attempt.userId)?.email ?? null, score: attempt.score, maxScore: attempt.maxScore, status: attempt.status, submittedAt: attempt.submittedAt, submissionReason: attempt.submissionReason, integrityRiskScore: attempt.integrityRiskScore })).sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
}

export async function sendSupportMessage(input: { attemptId: number; senderUserId: number; senderRole: "student" | "admin"; message: string }) {
  const db = getFirebaseFirestore();
  const attempt = await getAttemptOwner(input.attemptId);
  if (!attempt || !canSendSupportMessage({ requesterUserId: input.senderUserId, attemptOwnerUserId: attempt.userId, attemptStatus: attempt.status, senderRole: input.senderRole })) throw new Error("Support chat is available only during your active exam attempt.");
  const ref = db.collection("attempts").doc(String(input.attemptId)).collection("support").doc();
  await ref.create({ id: ref.id, ...input, createdAt: Timestamp.now(), readAt: null });
  return { id: ref.id };
}

export async function getSupportMessages(attemptId: number, requesterUserId: number, isAdmin: boolean) {
  const db = getFirebaseFirestore();
  const attempt = await getAttemptOwner(attemptId);
  if (!attempt || !canAccessAttemptReport({ requesterUserId, attemptOwnerUserId: attempt.userId, isAdmin })) throw new Error("Support conversation was not found.");
  const supportCollection = db.collection("attempts").doc(String(attemptId)).collection("support");
  const messages = await supportCollection.get();
  if (isAdmin) {
    const batch = db.batch();
    messages.docs.filter(doc => doc.data().senderRole === "student" && !doc.data().readAt).forEach(doc => batch.update(doc.ref, { readAt: Timestamp.now() }));
    await batch.commit();
  }
  const users = await Promise.all(messages.docs.map(doc => db.collection("users").doc(String(doc.data().senderUserId)).get()));
  const nameMap = new Map(users.filter(user => user.exists).map(user => [Number(user.id), user.data()!.name]));
  return { attempt, messages: messages.docs.map(doc => ({ ...doc.data(), createdAt: asDate(doc.data().createdAt), readAt: asDate(doc.data().readAt), senderName: nameMap.get(Number(doc.data().senderUserId)) ?? null })).sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)) };
}

export async function listSupportInbox() {
  const db = getFirebaseFirestore();
  const messages = await db.collectionGroup("support").get();
  const records = await Promise.all(messages.docs.map(async doc => {
    const message = doc.data();
    const attemptId = Number(message.attemptId);
    const attempt = await getAttemptOwner(attemptId);
    const [exam, student] = attempt ? await Promise.all([db.collection("exams").doc(String(attempt.examId)).get(), db.collection("users").doc(String(attempt.userId)).get()]) : [null, null];
    return { id: message.id, attemptId, senderRole: message.senderRole, message: message.message, createdAt: asDate(message.createdAt), readAt: asDate(message.readAt), examTitle: exam?.data()?.title ?? "Assessment", studentName: student?.data()?.name ?? null, studentEmail: student?.data()?.email ?? null };
  }));
  return records.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).slice(0, 100);
}

export async function createAdminNotification(input: { type: "support_message" | "high_risk_integrity"; title: string; body: string; destination: string; relatedAttemptId?: number | null }) {
  const ref = getFirebaseFirestore().collection("adminNotifications").doc();
  await ref.create({ id: ref.id, ...input, relatedAttemptId: input.relatedAttemptId ?? null, createdAt: Timestamp.now(), readAt: null });
  return { id: ref.id };
}

export async function listAdminNotifications() {
  const snapshot = await getFirebaseFirestore().collection("adminNotifications").get();
  return snapshot.docs.map(doc => ({ ...doc.data(), createdAt: asDate(doc.data().createdAt), readAt: asDate(doc.data().readAt) })).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).slice(0, 80);
}

export async function markAdminNotificationRead(notificationId: string | number) {
  await getFirebaseFirestore().collection("adminNotifications").doc(String(notificationId)).set({ readAt: Timestamp.now() }, { merge: true });
}
