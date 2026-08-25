import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  attemptAnswers,
  examAttempts,
  examAuditLogs,
  exams,
  proctoringEvents,
  questions,
  studentProfiles,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { calculateExamScore, normalizeProctoringConfig, type AnswerOption } from "../shared/proctoring";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await requireDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getStudentProfile(userId: number) {
  const db = await requireDb();
  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
  return profile[0] ?? null;
}

export async function upsertStudentProfile(input: {
  userId: number;
  fullName: string;
  collegeName?: string | null;
  rollNumber?: string | null;
}) {
  const db = await requireDb();
  await db
    .insert(studentProfiles)
    .values(input)
    .onDuplicateKeyUpdate({
      set: {
        fullName: input.fullName,
        collegeName: input.collegeName ?? null,
        rollNumber: input.rollNumber ?? null,
      },
    });
  return getStudentProfile(input.userId);
}

export async function getStudentOverview(userId: number) {
  const db = await requireDb();
  const [profile, availableExams, attempts] = await Promise.all([
    getStudentProfile(userId),
    db
      .select({
        id: exams.id,
        title: exams.title,
        description: exams.description,
        durationSeconds: exams.durationSeconds,
        startsAt: exams.startsAt,
        endsAt: exams.endsAt,
        status: exams.status,
      })
      .from(exams)
      .where(sql`${exams.status} in ('scheduled', 'live')`)
      .orderBy(asc(exams.startsAt))
      .limit(30),
    db
      .select({
        id: examAttempts.id,
        examId: examAttempts.examId,
        examTitle: exams.title,
        status: examAttempts.status,
        score: examAttempts.score,
        maxScore: examAttempts.maxScore,
        startedAt: examAttempts.startedAt,
        submittedAt: examAttempts.submittedAt,
        submissionReason: examAttempts.submissionReason,
        integrityRiskScore: examAttempts.integrityRiskScore,
        releaseResultsImmediately: exams.releaseResultsImmediately,
      })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.id))
      .where(eq(examAttempts.userId, userId))
      .orderBy(desc(examAttempts.startedAt))
      .limit(30),
  ]);
  return { profile, availableExams, attempts };
}

export async function startExamAttempt(userId: number, examId: number) {
  const db = await requireDb();
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam || !["scheduled", "live"].includes(exam.status)) throw new Error("This exam is not available.");
  const now = new Date();
  if ((exam.startsAt && exam.startsAt > now) || (exam.endsAt && exam.endsAt < now)) {
    throw new Error("This exam is outside its scheduled window.");
  }
  const [existing] = await db
    .select({ id: examAttempts.id })
    .from(examAttempts)
    .where(and(eq(examAttempts.userId, userId), eq(examAttempts.examId, examId), eq(examAttempts.status, "in_progress")))
    .limit(1);
  if (existing) return existing;
  const priorAttempts = await db
    .select({ id: examAttempts.id })
    .from(examAttempts)
    .where(and(eq(examAttempts.userId, userId), eq(examAttempts.examId, examId)));
  if (priorAttempts.length >= exam.maxAttempts) throw new Error("The maximum number of attempts has been reached.");
  const [created] = await db.insert(examAttempts).values({ examId, userId }).$returningId();
  await writeAuditLog(userId, "attempt.started", "examAttempt", created!.id, { examId });
  return created!;
}

export async function getStudentAttempt(userId: number, attemptId: number) {
  const db = await requireDb();
  const [attempt] = await db
    .select({
      id: examAttempts.id,
      examId: examAttempts.examId,
      status: examAttempts.status,
      startedAt: examAttempts.startedAt,
      submittedAt: examAttempts.submittedAt,
      submissionReason: examAttempts.submissionReason,
      score: examAttempts.score,
      maxScore: examAttempts.maxScore,
      integrityRiskScore: examAttempts.integrityRiskScore,
      title: exams.title,
      description: exams.description,
      durationSeconds: exams.durationSeconds,
      endsAt: exams.endsAt,
      releaseResultsImmediately: exams.releaseResultsImmediately,
      proctoringConfig: exams.proctoringConfig,
    })
    .from(examAttempts)
    .innerJoin(exams, eq(examAttempts.examId, exams.id))
    .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)))
    .limit(1);
  if (!attempt) return null;
  const [questionRows, answerRows, eventRows] = await Promise.all([
    db
      .select({
        id: questions.id,
        prompt: questions.prompt,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        points: questions.points,
        orderIndex: questions.orderIndex,
      })
      .from(questions)
      .where(eq(questions.examId, attempt.examId))
      .orderBy(asc(questions.orderIndex)),
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)),
    db
      .select({ id: proctoringEvents.id, eventType: proctoringEvents.eventType, severity: proctoringEvents.severity, detectedAt: proctoringEvents.detectedAt })
      .from(proctoringEvents)
      .where(eq(proctoringEvents.attemptId, attemptId))
      .orderBy(desc(proctoringEvents.detectedAt)),
  ]);
  return { attempt, questions: questionRows, answers: answerRows, events: eventRows };
}

export async function saveAttemptAnswer(
  userId: number,
  input: { attemptId: number; questionId: number; selectedOption: AnswerOption | null; markedForReview: boolean }
) {
  const db = await requireDb();
  const [attempt] = await db
    .select({ id: examAttempts.id, examId: examAttempts.examId, status: examAttempts.status })
    .from(examAttempts)
    .where(and(eq(examAttempts.id, input.attemptId), eq(examAttempts.userId, userId)))
    .limit(1);
  if (!attempt || attempt.status !== "in_progress") throw new Error("This exam attempt is no longer editable.");
  const [question] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.id, input.questionId), eq(questions.examId, attempt.examId)))
    .limit(1);
  if (!question) throw new Error("The selected question does not belong to this exam.");
  await db
    .insert(attemptAnswers)
    .values({
      attemptId: input.attemptId,
      questionId: input.questionId,
      selectedOption: input.selectedOption,
      markedForReview: input.markedForReview ? 1 : 0,
      answeredAt: input.selectedOption ? new Date() : null,
    })
    .onDuplicateKeyUpdate({
      set: {
        selectedOption: input.selectedOption,
        markedForReview: input.markedForReview ? 1 : 0,
        answeredAt: input.selectedOption ? new Date() : null,
      },
    });
  await db.update(examAttempts).set({ lastActivityAt: new Date() }).where(eq(examAttempts.id, input.attemptId));
  return { success: true };
}

export async function submitExamAttempt(
  userId: number,
  attemptId: number,
  reason: "manual" | "timeout" | "integrity_threshold" | "admin_action"
) {
  const db = await requireDb();
  const [attempt] = await db
    .select({ id: examAttempts.id, examId: examAttempts.examId, status: examAttempts.status })
    .from(examAttempts)
    .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId)))
    .limit(1);
  if (!attempt) throw new Error("Exam attempt was not found.");
  if (attempt.status !== "in_progress") {
    const [completed] = await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1);
    return completed!;
  }
  const [questionRows, answerRows] = await Promise.all([
    db
      .select({ id: questions.id, correctOption: questions.correctOption, points: questions.points })
      .from(questions)
      .where(eq(questions.examId, attempt.examId)),
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)),
  ]);
  const selectedAnswers = new Map(answerRows.map(answer => [answer.questionId, answer.selectedOption as AnswerOption | null]));
  const result = calculateExamScore(
    questionRows.map(question => ({ ...question, correctOption: question.correctOption as AnswerOption })),
    selectedAnswers
  );
  await db.transaction(async tx => {
    for (const answer of answerRows) {
      const question = questionRows.find(row => row.id === answer.questionId);
      await tx
        .update(attemptAnswers)
        .set({ isCorrect: question && answer.selectedOption === question.correctOption ? 1 : 0 })
        .where(eq(attemptAnswers.id, answer.id));
    }
    await tx
      .update(examAttempts)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        submissionReason: reason,
        score: result.score,
        maxScore: result.maxScore,
        lastActivityAt: new Date(),
      })
      .where(eq(examAttempts.id, attemptId));
  });
  await writeAuditLog(userId, "attempt.submitted", "examAttempt", attemptId, { reason, ...result });
  return { id: attemptId, ...result, reason };
}

export async function recordProctoringEvent(
  userId: number,
  input: {
    attemptId: number;
    eventType: (typeof proctoringEvents.$inferInsert)["eventType"];
    durationMs: number;
    metadata?: Record<string, unknown>;
  }
) {
  const db = await requireDb();
  const [attempt] = await db
    .select({ id: examAttempts.id, status: examAttempts.status, proctoringConfig: exams.proctoringConfig })
    .from(examAttempts)
    .innerJoin(exams, eq(examAttempts.examId, exams.id))
    .where(and(eq(examAttempts.id, input.attemptId), eq(examAttempts.userId, userId)))
    .limit(1);
  if (!attempt || attempt.status !== "in_progress") throw new Error("This exam attempt is not accepting integrity events.");
  const config = normalizeProctoringConfig(attempt.proctoringConfig);
  const [existingCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(proctoringEvents)
    .where(eq(proctoringEvents.attemptId, input.attemptId));
  const eventCount = Number(existingCount?.count ?? 0) + 1;
  const severity = eventCount >= config.autoSubmitEventCount ? "critical" : eventCount >= config.warningEventCount ? "warning" : "info";
  await db.insert(proctoringEvents).values({ ...input, severity });
  await db
    .update(examAttempts)
    .set({ integrityRiskScore: eventCount, lastActivityAt: new Date() })
    .where(eq(examAttempts.id, input.attemptId));
  return { eventCount, proctoringConfig: config };
}

export async function listAdminExams() {
  const db = await requireDb();
  return db
    .select({
      id: exams.id,
      title: exams.title,
      description: exams.description,
      durationSeconds: exams.durationSeconds,
      startsAt: exams.startsAt,
      endsAt: exams.endsAt,
      status: exams.status,
      maxAttempts: exams.maxAttempts,
      createdAt: exams.createdAt,
    })
    .from(exams)
    .orderBy(desc(exams.createdAt));
}

export async function getAdminExam(examId: number) {
  const db = await requireDb();
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return null;
  const examQuestions = await db.select().from(questions).where(eq(questions.examId, examId)).orderBy(asc(questions.orderIndex));
  return { exam, questions: examQuestions };
}

export async function createExam(
  adminUserId: number,
  input: {
    title: string;
    description?: string | null;
    durationSeconds: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
    status: "draft" | "scheduled" | "live" | "closed" | "archived";
    maxAttempts: number;
    shuffleQuestions: boolean;
    releaseResultsImmediately: boolean;
    proctoringConfig: Record<string, unknown>;
    questions: Array<{
      prompt: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: AnswerOption;
      points: number;
    }>;
  }
) {
  const db = await requireDb();
  const [created] = await db
    .insert(exams)
    .values({
      createdByUserId: adminUserId,
      title: input.title,
      description: input.description ?? null,
      durationSeconds: input.durationSeconds,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      status: input.status,
      maxAttempts: input.maxAttempts,
      shuffleQuestions: input.shuffleQuestions ? 1 : 0,
      releaseResultsImmediately: input.releaseResultsImmediately ? 1 : 0,
      proctoringConfig: normalizeProctoringConfig(input.proctoringConfig),
    })
    .$returningId();
  await db.insert(questions).values(
    input.questions.map((question, index) => ({ ...question, examId: created!.id, orderIndex: index }))
  );
  await writeAuditLog(adminUserId, "exam.created", "exam", created!.id, { questionCount: input.questions.length });
  return { id: created!.id };
}

export async function updateExam(
  adminUserId: number,
  examId: number,
  input: {
    title: string;
    description?: string | null;
    durationSeconds: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
    status: "draft" | "scheduled" | "live" | "closed" | "archived";
    maxAttempts: number;
    shuffleQuestions: boolean;
    releaseResultsImmediately: boolean;
    proctoringConfig: Record<string, unknown>;
    questions: Array<{
      prompt: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      correctOption: AnswerOption;
      points: number;
    }>;
  }
) {
  const db = await requireDb();
  const [exam] = await db.select({ id: exams.id }).from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) throw new Error("Assessment was not found.");
  const [attemptCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(examAttempts)
    .where(eq(examAttempts.examId, examId));
  if (Number(attemptCount?.count ?? 0) > 0) {
    throw new Error("Assessments with recorded attempts cannot have their questions or settings changed.");
  }
  await db.transaction(async tx => {
    await tx
      .update(exams)
      .set({
        title: input.title,
        description: input.description ?? null,
        durationSeconds: input.durationSeconds,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        status: input.status,
        maxAttempts: input.maxAttempts,
        shuffleQuestions: input.shuffleQuestions ? 1 : 0,
        releaseResultsImmediately: input.releaseResultsImmediately ? 1 : 0,
        proctoringConfig: normalizeProctoringConfig(input.proctoringConfig),
      })
      .where(eq(exams.id, examId));
    await tx.delete(questions).where(eq(questions.examId, examId));
    await tx.insert(questions).values(input.questions.map((question, index) => ({ ...question, examId, orderIndex: index })));
  });
  await writeAuditLog(adminUserId, "exam.updated", "exam", examId, { questionCount: input.questions.length });
  return { id: examId };
}

export async function getAttemptReview(attemptId: number) {
  const db = await requireDb();
  const [attempt] = await db
    .select({
      id: examAttempts.id,
      status: examAttempts.status,
      startedAt: examAttempts.startedAt,
      submittedAt: examAttempts.submittedAt,
      submissionReason: examAttempts.submissionReason,
      score: examAttempts.score,
      maxScore: examAttempts.maxScore,
      integrityRiskScore: examAttempts.integrityRiskScore,
      examTitle: exams.title,
      studentName: users.name,
      studentEmail: users.email,
      rollNumber: studentProfiles.rollNumber,
      collegeName: studentProfiles.collegeName,
    })
    .from(examAttempts)
    .innerJoin(exams, eq(examAttempts.examId, exams.id))
    .innerJoin(users, eq(examAttempts.userId, users.id))
    .leftJoin(studentProfiles, eq(examAttempts.userId, studentProfiles.userId))
    .where(eq(examAttempts.id, attemptId))
    .limit(1);
  if (!attempt) return null;
  const [answers, events] = await Promise.all([
    db
      .select({
        questionId: questions.id,
        prompt: questions.prompt,
        selectedOption: attemptAnswers.selectedOption,
        correctOption: questions.correctOption,
        isCorrect: attemptAnswers.isCorrect,
        markedForReview: attemptAnswers.markedForReview,
      })
      .from(questions)
      .leftJoin(attemptAnswers, and(eq(attemptAnswers.questionId, questions.id), eq(attemptAnswers.attemptId, attemptId)))
      .where(eq(questions.examId, (await db.select({ examId: examAttempts.examId }).from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1))[0]!.examId))
      .orderBy(asc(questions.orderIndex)),
    db.select().from(proctoringEvents).where(eq(proctoringEvents.attemptId, attemptId)).orderBy(desc(proctoringEvents.detectedAt)),
  ]);
  return { attempt, answers, events };
}

export async function getResultsExport() {
  const db = await requireDb();
  return db
    .select({
      attemptId: examAttempts.id,
      examTitle: exams.title,
      studentName: users.name,
      studentEmail: users.email,
      score: examAttempts.score,
      maxScore: examAttempts.maxScore,
      status: examAttempts.status,
      submittedAt: examAttempts.submittedAt,
      submissionReason: examAttempts.submissionReason,
      integrityRiskScore: examAttempts.integrityRiskScore,
    })
    .from(examAttempts)
    .innerJoin(exams, eq(examAttempts.examId, exams.id))
    .innerJoin(users, eq(examAttempts.userId, users.id))
    .orderBy(desc(examAttempts.submittedAt));
}

export async function writeAuditLog(
  actorUserId: number,
  action: string,
  entityType: string,
  entityId: number | null,
  metadata?: Record<string, unknown>
) {
  const db = await requireDb();
  await db.insert(examAuditLogs).values({ actorUserId, action, entityType, entityId, metadata });
}
