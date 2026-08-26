// server/vercelApp.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);
var studentProfiles = mysqlTable(
  "studentProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    fullName: varchar("fullName", { length: 255 }).notNull(),
    collegeName: varchar("collegeName", { length: 255 }),
    rollNumber: varchar("rollNumber", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("studentProfiles_userId_unique").on(table.userId)]
);
var localCredentials = mysqlTable(
  "localCredentials",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [uniqueIndex("localCredentials_userId_unique").on(table.userId)]
);
var accountTokens = mysqlTable(
  "accountTokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
    purpose: mysqlEnum("purpose", ["verify_email", "reset_password"]).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    consumedAt: timestamp("consumedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [uniqueIndex("accountTokens_hash_unique").on(table.tokenHash), index("accountTokens_user_purpose_idx").on(table.userId, table.purpose, table.expiresAt)]
);
var exams = mysqlTable(
  "exams",
  {
    id: int("id").autoincrement().primaryKey(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    durationSeconds: int("durationSeconds").notNull(),
    startsAt: timestamp("startsAt"),
    endsAt: timestamp("endsAt"),
    status: mysqlEnum("status", ["draft", "scheduled", "live", "closed", "archived"]).default("draft").notNull(),
    maxAttempts: int("maxAttempts").default(1).notNull(),
    shuffleQuestions: int("shuffleQuestions").default(0).notNull(),
    releaseResultsImmediately: int("releaseResultsImmediately").default(1).notNull(),
    proctoringConfig: json("proctoringConfig"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [index("exams_status_idx").on(table.status), index("exams_schedule_idx").on(table.startsAt, table.endsAt)]
);
var questions = mysqlTable(
  "questions",
  {
    id: int("id").autoincrement().primaryKey(),
    examId: int("examId").notNull().references(() => exams.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    optionA: text("optionA").notNull(),
    optionB: text("optionB").notNull(),
    optionC: text("optionC").notNull(),
    optionD: text("optionD").notNull(),
    correctOption: mysqlEnum("correctOption", ["A", "B", "C", "D"]).notNull(),
    points: int("points").default(1).notNull(),
    orderIndex: int("orderIndex").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
  },
  (table) => [index("questions_exam_order_idx").on(table.examId, table.orderIndex)]
);
var examAttempts = mysqlTable(
  "examAttempts",
  {
    id: int("id").autoincrement().primaryKey(),
    examId: int("examId").notNull().references(() => exams.id, { onDelete: "restrict" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["in_progress", "submitted", "reviewed", "invalidated"]).default("in_progress").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    submittedAt: timestamp("submittedAt"),
    submissionReason: mysqlEnum("submissionReason", ["manual", "timeout", "integrity_threshold", "admin_action"]),
    score: int("score"),
    maxScore: int("maxScore"),
    integrityRiskScore: int("integrityRiskScore").default(0).notNull(),
    lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull()
  },
  (table) => [index("examAttempts_exam_user_idx").on(table.examId, table.userId), index("examAttempts_status_idx").on(table.status)]
);
var attemptAnswers = mysqlTable(
  "attemptAnswers",
  {
    id: int("id").autoincrement().primaryKey(),
    attemptId: int("attemptId").notNull().references(() => examAttempts.id, { onDelete: "cascade" }),
    questionId: int("questionId").notNull().references(() => questions.id, { onDelete: "restrict" }),
    selectedOption: mysqlEnum("selectedOption", ["A", "B", "C", "D"]),
    markedForReview: int("markedForReview").default(0).notNull(),
    isCorrect: int("isCorrect"),
    answeredAt: timestamp("answeredAt")
  },
  (table) => [uniqueIndex("attemptAnswers_attempt_question_unique").on(table.attemptId, table.questionId)]
);
var proctoringEvents = mysqlTable(
  "proctoringEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    attemptId: int("attemptId").notNull().references(() => examAttempts.id, { onDelete: "cascade" }),
    eventType: mysqlEnum("eventType", [
      "camera_interrupted",
      "face_absent",
      "multiple_faces",
      "fullscreen_exit",
      "tab_hidden",
      "device_check_failed",
      "audio_activity"
    ]).notNull(),
    severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("warning").notNull(),
    detectedAt: timestamp("detectedAt").defaultNow().notNull(),
    durationMs: int("durationMs").default(0).notNull(),
    metadata: json("metadata"),
    resolvedAt: timestamp("resolvedAt")
  },
  (table) => [index("proctoringEvents_attempt_time_idx").on(table.attemptId, table.detectedAt)]
);
var supportMessages = mysqlTable(
  "supportMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    attemptId: int("attemptId").notNull().references(() => examAttempts.id, { onDelete: "cascade" }),
    senderUserId: int("senderUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    senderRole: mysqlEnum("senderRole", ["student", "admin"]).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    readAt: timestamp("readAt")
  },
  (table) => [index("supportMessages_attempt_time_idx").on(table.attemptId, table.createdAt)]
);
var adminNotifications = mysqlTable(
  "adminNotifications",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", ["support_message", "high_risk_integrity"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    destination: varchar("destination", { length: 512 }).notNull(),
    relatedAttemptId: int("relatedAttemptId").references(() => examAttempts.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    readAt: timestamp("readAt")
  },
  (table) => [index("adminNotifications_read_time_idx").on(table.readAt, table.createdAt)]
);
var examAuditLogs = mysqlTable(
  "examAuditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    entityId: int("entityId"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => [index("examAuditLogs_entity_idx").on(table.entityType, table.entityId), index("examAuditLogs_actor_idx").on(table.actorUserId)]
);

// shared/proctoring.ts
var EVENT_TYPES = [
  "camera_interrupted",
  "face_absent",
  "multiple_faces",
  "fullscreen_exit",
  "tab_hidden",
  "device_check_failed",
  "audio_activity"
];
var IMMEDIATE_SUBMISSION_EVENT_TYPES = ["tab_hidden", "audio_activity"];
function requiresImmediateIntegritySubmission(eventType) {
  return IMMEDIATE_SUBMISSION_EVENT_TYPES.includes(eventType);
}
var DEFAULT_PROCTORING_CONFIG = {
  faceAbsentThresholdSeconds: 3,
  multipleFaceThresholdSeconds: 3,
  warningEventCount: 2,
  autoSubmitEventCount: 5,
  immediateSubmitOnFocusLoss: true,
  audioMonitoringEnabled: false,
  audioActivityThresholdSeconds: 4,
  audioActivityLevel: 18,
  immediateSubmitOnAudioActivity: false
};
function normalizeProctoringConfig(value) {
  if (!value || typeof value !== "object") return DEFAULT_PROCTORING_CONFIG;
  const candidate = value;
  return {
    faceAbsentThresholdSeconds: Number.isInteger(candidate.faceAbsentThresholdSeconds) && candidate.faceAbsentThresholdSeconds > 0 ? candidate.faceAbsentThresholdSeconds : DEFAULT_PROCTORING_CONFIG.faceAbsentThresholdSeconds,
    multipleFaceThresholdSeconds: Number.isInteger(candidate.multipleFaceThresholdSeconds) && candidate.multipleFaceThresholdSeconds > 0 ? candidate.multipleFaceThresholdSeconds : DEFAULT_PROCTORING_CONFIG.multipleFaceThresholdSeconds,
    warningEventCount: Number.isInteger(candidate.warningEventCount) && candidate.warningEventCount > 0 ? candidate.warningEventCount : DEFAULT_PROCTORING_CONFIG.warningEventCount,
    autoSubmitEventCount: Number.isInteger(candidate.autoSubmitEventCount) && candidate.autoSubmitEventCount > 0 ? candidate.autoSubmitEventCount : DEFAULT_PROCTORING_CONFIG.autoSubmitEventCount,
    immediateSubmitOnFocusLoss: typeof candidate.immediateSubmitOnFocusLoss === "boolean" ? candidate.immediateSubmitOnFocusLoss : DEFAULT_PROCTORING_CONFIG.immediateSubmitOnFocusLoss,
    audioMonitoringEnabled: typeof candidate.audioMonitoringEnabled === "boolean" ? candidate.audioMonitoringEnabled : DEFAULT_PROCTORING_CONFIG.audioMonitoringEnabled,
    audioActivityThresholdSeconds: Number.isInteger(candidate.audioActivityThresholdSeconds) && candidate.audioActivityThresholdSeconds > 0 ? candidate.audioActivityThresholdSeconds : DEFAULT_PROCTORING_CONFIG.audioActivityThresholdSeconds,
    audioActivityLevel: Number.isInteger(candidate.audioActivityLevel) && candidate.audioActivityLevel >= 1 && candidate.audioActivityLevel <= 127 ? candidate.audioActivityLevel : DEFAULT_PROCTORING_CONFIG.audioActivityLevel,
    immediateSubmitOnAudioActivity: typeof candidate.immediateSubmitOnAudioActivity === "boolean" ? candidate.immediateSubmitOnAudioActivity : DEFAULT_PROCTORING_CONFIG.immediateSubmitOnAudioActivity
  };
}
function getIntegrityEscalation(eventCount, config) {
  return {
    shouldWarn: eventCount >= config.warningEventCount,
    shouldAutoSubmit: eventCount >= config.autoSubmitEventCount
  };
}
function calculateExamScore(questions2, selectedAnswers) {
  const maxScore = questions2.reduce((total, question) => total + question.points, 0);
  const score = questions2.reduce(
    (total, question) => selectedAnswers.get(question.id) === question.correctOption ? total + question.points : total,
    0
  );
  return { score, maxScore, percentage: maxScore === 0 ? 0 : Math.round(score / maxScore * 100) };
}

// shared/accessControl.ts
function canAccessAttemptReport(input) {
  return input.isAdmin || input.requesterUserId === input.attemptOwnerUserId;
}
function canSendSupportMessage(input) {
  if (input.senderRole === "admin") return true;
  return input.requesterUserId === input.attemptOwnerUserId && input.attemptStatus === "in_progress";
}

// server/accountSecurity.ts
import { createHash, randomBytes } from "node:crypto";
function createAccountTokenValue() {
  return randomBytes(32).toString("base64url");
}
function hashAccountToken(value) {
  return createHash("sha256").update(value).digest("hex");
}
function getTokenExpiry(purpose, now = /* @__PURE__ */ new Date()) {
  const minutes = purpose === "verify_email" ? 24 * 60 : 60;
  return new Date(now.getTime() + minutes * 6e4);
}
function didConsumeTokenExactlyOnce(affectedRows) {
  return affectedRows === 1;
}
function getAffectedRowCount(result) {
  if (Array.isArray(result)) return getAffectedRowCount(result[0]);
  if (typeof result === "object" && result && "affectedRows" in result) {
    const value = result.affectedRows;
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/firebaseAdmin.ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
var FIREBASE_SERVICE_ACCOUNT_ENV = "FIREBASE_SERVICE_ACCOUNT_JSON";
var firebaseApp = null;
function parseFirebaseServiceAccount(raw) {
  if (!raw?.trim()) return null;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${FIREBASE_SERVICE_ACCOUNT_ENV} must contain valid JSON.`);
  }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(`${FIREBASE_SERVICE_ACCOUNT_ENV} is missing required service-account fields.`);
  }
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key.replace(/\\n/g, "\n")
  };
}
function isFirebaseAdminConfigured(raw = process.env[FIREBASE_SERVICE_ACCOUNT_ENV]) {
  return Boolean(raw?.trim());
}
function getFirebaseAdminApp() {
  if (firebaseApp) return firebaseApp;
  const serviceAccount = parseFirebaseServiceAccount(process.env[FIREBASE_SERVICE_ACCOUNT_ENV]);
  if (!serviceAccount) {
    throw new Error(`${FIREBASE_SERVICE_ACCOUNT_ENV} is required for Firebase-backed production persistence.`);
  }
  firebaseApp = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  return firebaseApp;
}
function getFirebaseFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

// server/firestoreExamStore.ts
import { Timestamp } from "firebase-admin/firestore";
var asDate = (value) => !value ? null : value instanceof Timestamp ? value.toDate() : value;
var timestamp2 = (value) => value ? Timestamp.fromDate(value) : null;
var asBoolNumber = (value) => value ? 1 : 0;
async function nextId(entity) {
  const db = getFirebaseFirestore();
  return db.runTransaction(async (transaction) => {
    const counter = db.collection("meta").doc("counters");
    const snapshot = await transaction.get(counter);
    const id = Number(snapshot.data()?.[entity] ?? 0) + 1;
    transaction.set(counter, { [entity]: id }, { merge: true });
    return id;
  });
}
function presentExam(data) {
  return { ...data, startsAt: asDate(data.startsAt), endsAt: asDate(data.endsAt), createdAt: asDate(data.createdAt), updatedAt: asDate(data.updatedAt) };
}
function presentAttempt(data) {
  return { ...data, startedAt: asDate(data.startedAt), submittedAt: asDate(data.submittedAt), lastActivityAt: asDate(data.lastActivityAt) };
}
async function getAttemptOwner(attemptId) {
  const snapshot = await getFirebaseFirestore().collection("attempts").doc(String(attemptId)).get();
  return snapshot.exists ? presentAttempt(snapshot.data()) : null;
}
async function getStudentOverview(userId) {
  const db = getFirebaseFirestore();
  const [user, examSnapshot, attemptSnapshot] = await Promise.all([
    db.collection("users").doc(String(userId)).get(),
    db.collection("exams").get(),
    db.collection("attempts").where("userId", "==", userId).get()
  ]);
  const profile = user.exists && user.data()?.profile ? { id: userId, userId, ...user.data().profile, createdAt: asDate(user.data().createdAt), updatedAt: asDate(user.data().updatedAt) } : null;
  const availableExams = examSnapshot.docs.map((doc) => presentExam(doc.data())).filter((exam) => exam.status === "scheduled" || exam.status === "live").sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)).slice(0, 30).map((exam) => ({ id: exam.id, title: exam.title, description: exam.description, durationSeconds: exam.durationSeconds, startsAt: exam.startsAt, endsAt: exam.endsAt, status: exam.status, proctoringConfig: exam.proctoringConfig }));
  const examMap = new Map(examSnapshot.docs.map((doc) => [Number(doc.id), presentExam(doc.data())]));
  const attempts = attemptSnapshot.docs.map((doc) => presentAttempt(doc.data())).sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0)).slice(0, 30).map((attempt) => {
    const exam = examMap.get(attempt.examId);
    return { ...attempt, examTitle: exam?.title ?? "Assessment", releaseResultsImmediately: exam?.releaseResultsImmediately ?? 0 };
  });
  return { profile, availableExams, attempts };
}
async function startExamAttempt(userId, examId) {
  const db = getFirebaseFirestore();
  const examRef = db.collection("exams").doc(String(examId));
  return db.runTransaction(async (transaction) => {
    const examSnapshot = await transaction.get(examRef);
    if (!examSnapshot.exists) throw new Error("This exam is not available.");
    const exam = presentExam(examSnapshot.data());
    if (!["scheduled", "live"].includes(exam.status)) throw new Error("This exam is not available.");
    const now = /* @__PURE__ */ new Date();
    if (exam.startsAt && exam.startsAt > now || exam.endsAt && exam.endsAt < now) throw new Error("This exam is outside its scheduled window.");
    const existing = await transaction.get(db.collection("attempts").where("userId", "==", userId));
    const attempts = existing.docs.map((doc) => presentAttempt(doc.data())).filter((attempt) => attempt.examId === examId);
    const active = attempts.find((attempt) => attempt.status === "in_progress");
    if (active) return { id: active.id };
    if (attempts.length >= Number(exam.maxAttempts ?? 1)) throw new Error("The maximum number of attempts has been reached.");
    const id = await nextId("attempts");
    const nowTimestamp = Timestamp.now();
    transaction.create(db.collection("attempts").doc(String(id)), { id, examId, userId, status: "in_progress", startedAt: nowTimestamp, submittedAt: null, submissionReason: null, score: null, maxScore: null, integrityRiskScore: 0, lastActivityAt: nowTimestamp });
    return { id };
  });
}
async function getStudentAttempt(userId, attemptId) {
  const db = getFirebaseFirestore();
  const attemptSnapshot = await db.collection("attempts").doc(String(attemptId)).get();
  if (!attemptSnapshot.exists) return null;
  const attempt = presentAttempt(attemptSnapshot.data());
  if (attempt.userId !== userId) return null;
  const [examSnapshot, questions2, answers, events] = await Promise.all([
    db.collection("exams").doc(String(attempt.examId)).get(),
    db.collection("exams").doc(String(attempt.examId)).collection("questions").get(),
    db.collection("attempts").doc(String(attemptId)).collection("answers").get(),
    db.collection("attempts").doc(String(attemptId)).collection("events").get()
  ]);
  if (!examSnapshot.exists) return null;
  const exam = presentExam(examSnapshot.data());
  const safeQuestions = questions2.docs.map((doc) => doc.data()).sort((a, b) => a.orderIndex - b.orderIndex).map((question) => ({ id: question.id, prompt: question.prompt, optionA: question.optionA, optionB: question.optionB, optionC: question.optionC, optionD: question.optionD, points: question.points, orderIndex: question.orderIndex }));
  return {
    attempt: { ...attempt, title: exam.title, description: exam.description, durationSeconds: exam.durationSeconds, endsAt: exam.endsAt, releaseResultsImmediately: exam.releaseResultsImmediately, proctoringConfig: exam.proctoringConfig },
    questions: safeQuestions,
    answers: answers.docs.map((doc) => ({ ...doc.data(), answeredAt: asDate(doc.data().answeredAt) })),
    events: events.docs.map((doc) => ({ ...doc.data(), detectedAt: asDate(doc.data().detectedAt) })).sort((a, b) => (b.detectedAt?.getTime() ?? 0) - (a.detectedAt?.getTime() ?? 0))
  };
}
async function saveAttemptAnswer(userId, input) {
  const db = getFirebaseFirestore();
  const attemptRef = db.collection("attempts").doc(String(input.attemptId));
  await db.runTransaction(async (transaction) => {
    const attemptSnapshot = await transaction.get(attemptRef);
    if (!attemptSnapshot.exists) throw new Error("This exam attempt is no longer editable.");
    const attempt = presentAttempt(attemptSnapshot.data());
    if (attempt.userId !== userId || attempt.status !== "in_progress") throw new Error("This exam attempt is no longer editable.");
    const question = await transaction.get(db.collection("exams").doc(String(attempt.examId)).collection("questions").doc(String(input.questionId)));
    if (!question.exists) throw new Error("The selected question does not belong to this exam.");
    transaction.set(attemptRef.collection("answers").doc(String(input.questionId)), { id: input.questionId, attemptId: input.attemptId, questionId: input.questionId, selectedOption: input.selectedOption, markedForReview: asBoolNumber(input.markedForReview), isCorrect: null, answeredAt: input.selectedOption ? Timestamp.now() : null }, { merge: true });
    transaction.update(attemptRef, { lastActivityAt: Timestamp.now() });
  });
  return { success: true };
}
async function submitExamAttempt(userId, attemptId, reason) {
  const db = getFirebaseFirestore();
  const attemptRef = db.collection("attempts").doc(String(attemptId));
  return db.runTransaction(async (transaction) => {
    const attemptSnapshot = await transaction.get(attemptRef);
    if (!attemptSnapshot.exists) throw new Error("Exam attempt was not found.");
    const attempt = presentAttempt(attemptSnapshot.data());
    if (attempt.userId !== userId) throw new Error("Exam attempt was not found.");
    if (attempt.status !== "in_progress") return { id: attemptId, score: attempt.score, maxScore: attempt.maxScore, reason: attempt.submissionReason };
    const [questionSnapshot, answerSnapshot] = await Promise.all([
      transaction.get(db.collection("exams").doc(String(attempt.examId)).collection("questions")),
      transaction.get(attemptRef.collection("answers"))
    ]);
    const questions2 = questionSnapshot.docs.map((doc) => doc.data());
    const answers = new Map(answerSnapshot.docs.map((doc) => [Number(doc.data().questionId), doc.data().selectedOption]));
    const result = calculateExamScore(questions2.map((question) => ({ id: question.id, correctOption: question.correctOption, points: question.points })), answers);
    for (const answer of answerSnapshot.docs) {
      const question = questions2.find((row) => row.id === answer.data().questionId);
      transaction.update(answer.ref, { isCorrect: question && answer.data().selectedOption === question.correctOption ? 1 : 0 });
    }
    transaction.update(attemptRef, { status: "submitted", submittedAt: Timestamp.now(), submissionReason: reason, score: result.score, maxScore: result.maxScore, lastActivityAt: Timestamp.now() });
    return { id: attemptId, ...result, reason };
  });
}
async function recordProctoringEvent(userId, input) {
  const db = getFirebaseFirestore();
  const attemptRef = db.collection("attempts").doc(String(input.attemptId));
  return db.runTransaction(async (transaction) => {
    const attemptSnapshot = await transaction.get(attemptRef);
    if (!attemptSnapshot.exists) throw new Error("This exam attempt is not accepting integrity events.");
    const attempt = presentAttempt(attemptSnapshot.data());
    if (attempt.userId !== userId || attempt.status !== "in_progress") throw new Error("This exam attempt is not accepting integrity events.");
    const exam = await transaction.get(db.collection("exams").doc(String(attempt.examId)));
    const config = normalizeProctoringConfig(exam.data()?.proctoringConfig);
    const events = await transaction.get(attemptRef.collection("events"));
    const eventCount = events.size + 1;
    const severity = eventCount >= config.autoSubmitEventCount ? "critical" : eventCount >= config.warningEventCount ? "warning" : "info";
    const eventRef = attemptRef.collection("events").doc();
    transaction.create(eventRef, { id: eventRef.id, attemptId: input.attemptId, eventType: input.eventType, severity, detectedAt: Timestamp.now(), durationMs: input.durationMs, metadata: input.metadata ?? null, resolvedAt: null });
    transaction.update(attemptRef, { integrityRiskScore: eventCount, lastActivityAt: Timestamp.now() });
    return { eventCount, proctoringConfig: config };
  });
}
async function writeAuditLog(actorUserId, action, entityType, entityId, metadata) {
  await getFirebaseFirestore().collection("auditLogs").add({ actorUserId, action, entityType, entityId, metadata: metadata ?? null, createdAt: Timestamp.now() });
}
async function listAdminExams() {
  const snapshot = await getFirebaseFirestore().collection("exams").get();
  return snapshot.docs.map((doc) => presentExam(doc.data())).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).map((exam) => ({ id: exam.id, title: exam.title, description: exam.description, durationSeconds: exam.durationSeconds, startsAt: exam.startsAt, endsAt: exam.endsAt, status: exam.status, maxAttempts: exam.maxAttempts, createdAt: exam.createdAt }));
}
async function getAdminExam(examId) {
  const db = getFirebaseFirestore();
  const [examSnapshot, questionSnapshot] = await Promise.all([db.collection("exams").doc(String(examId)).get(), db.collection("exams").doc(String(examId)).collection("questions").get()]);
  if (!examSnapshot.exists) return null;
  const questionRows = questionSnapshot.docs.map((doc) => doc.data());
  const questions2 = questionRows.map((question) => ({ ...question, createdAt: asDate(question.createdAt), updatedAt: asDate(question.updatedAt) }));
  questions2.sort((a, b) => Number(a.orderIndex) - Number(b.orderIndex));
  return { exam: presentExam(examSnapshot.data()), questions: questions2 };
}
async function createExam(adminUserId, input) {
  const db = getFirebaseFirestore();
  const id = await nextId("exams");
  const now = Timestamp.now();
  const batch = db.batch();
  batch.create(db.collection("exams").doc(String(id)), { id, createdByUserId: adminUserId, title: input.title, description: input.description ?? null, durationSeconds: input.durationSeconds, startsAt: timestamp2(input.startsAt), endsAt: timestamp2(input.endsAt), status: input.status, maxAttempts: input.maxAttempts, shuffleQuestions: asBoolNumber(input.shuffleQuestions), releaseResultsImmediately: asBoolNumber(input.releaseResultsImmediately), proctoringConfig: normalizeProctoringConfig(input.proctoringConfig), createdAt: now, updatedAt: now });
  for (let index2 = 0; index2 < input.questions.length; index2 += 1) {
    const question = input.questions[index2];
    const questionId = await nextId("questions");
    batch.create(db.collection("exams").doc(String(id)).collection("questions").doc(String(questionId)), { id: questionId, examId: id, ...question, orderIndex: index2, createdAt: now, updatedAt: now });
  }
  await batch.commit();
  await writeAuditLog(adminUserId, "exam.created", "exam", id, { questionCount: input.questions.length });
  return { id };
}
async function updateExam(adminUserId, examId, input) {
  const db = getFirebaseFirestore();
  const examRef = db.collection("exams").doc(String(examId));
  const [examSnapshot, attemptSnapshot, existingQuestions] = await Promise.all([examRef.get(), db.collection("attempts").where("examId", "==", examId).get(), examRef.collection("questions").get()]);
  if (!examSnapshot.exists) throw new Error("Assessment was not found.");
  if (!attemptSnapshot.empty) throw new Error("Assessments with recorded attempts cannot have their questions or settings changed.");
  const batch = db.batch();
  batch.update(examRef, { title: input.title, description: input.description ?? null, durationSeconds: input.durationSeconds, startsAt: timestamp2(input.startsAt), endsAt: timestamp2(input.endsAt), status: input.status, maxAttempts: input.maxAttempts, shuffleQuestions: asBoolNumber(input.shuffleQuestions), releaseResultsImmediately: asBoolNumber(input.releaseResultsImmediately), proctoringConfig: normalizeProctoringConfig(input.proctoringConfig), updatedAt: Timestamp.now() });
  existingQuestions.docs.forEach((question) => batch.delete(question.ref));
  for (let index2 = 0; index2 < input.questions.length; index2 += 1) {
    const question = input.questions[index2];
    const questionId = await nextId("questions");
    batch.create(examRef.collection("questions").doc(String(questionId)), { id: questionId, examId, ...question, orderIndex: index2, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
  }
  await batch.commit();
  await writeAuditLog(adminUserId, "exam.updated", "exam", examId, { questionCount: input.questions.length });
  return { id: examId };
}
async function reopenExamAttempt(adminUserId, attemptId, basis, note) {
  const db = getFirebaseFirestore();
  const ref = db.collection("attempts").doc(String(attemptId));
  const [attemptSnapshot, events] = await Promise.all([ref.get(), ref.collection("events").get()]);
  if (!attemptSnapshot.exists) throw new Error("Exam attempt was not found.");
  const attempt = presentAttempt(attemptSnapshot.data());
  if (attempt.status === "in_progress") throw new Error("This attempt is already active.");
  const batch = db.batch();
  events.docs.forEach((event) => batch.delete(event.ref));
  batch.update(ref, { status: "in_progress", startedAt: Timestamp.now(), submittedAt: null, submissionReason: null, score: null, maxScore: null, integrityRiskScore: 0, lastActivityAt: Timestamp.now() });
  await batch.commit();
  await writeAuditLog(adminUserId, "attempt.reopened", "examAttempt", attemptId, { basis, note, clearedIntegrityEventCount: events.size });
  return { id: attemptId, status: "in_progress" };
}
async function getAttemptReview(attemptId) {
  const db = getFirebaseFirestore();
  const attemptSnapshot = await db.collection("attempts").doc(String(attemptId)).get();
  if (!attemptSnapshot.exists) return null;
  const attempt = presentAttempt(attemptSnapshot.data());
  const [examSnapshot, userSnapshot, questions2, answers, events] = await Promise.all([db.collection("exams").doc(String(attempt.examId)).get(), db.collection("users").doc(String(attempt.userId)).get(), db.collection("exams").doc(String(attempt.examId)).collection("questions").get(), db.collection("attempts").doc(String(attemptId)).collection("answers").get(), db.collection("attempts").doc(String(attemptId)).collection("events").get()]);
  if (!examSnapshot.exists || !userSnapshot.exists) return null;
  const exam = presentExam(examSnapshot.data());
  const user = userSnapshot.data();
  const answerMap = new Map(answers.docs.map((doc) => [Number(doc.data().questionId), doc.data()]));
  return { attempt: { ...attempt, examTitle: exam.title, studentName: user.name, studentEmail: user.email, rollNumber: user.profile?.rollNumber ?? null, collegeName: user.profile?.collegeName ?? null }, answers: questions2.docs.map((doc) => {
    const question = doc.data();
    const answer = answerMap.get(question.id);
    return { questionId: question.id, prompt: question.prompt, selectedOption: answer?.selectedOption ?? null, correctOption: question.correctOption, isCorrect: answer?.isCorrect ?? null, markedForReview: answer?.markedForReview ?? 0 };
  }).sort((a, b) => a.questionId - b.questionId), events: events.docs.map((doc) => ({ ...doc.data(), detectedAt: asDate(doc.data().detectedAt) })).sort((a, b) => (b.detectedAt?.getTime() ?? 0) - (a.detectedAt?.getTime() ?? 0)) };
}
async function getResultsExport() {
  const db = getFirebaseFirestore();
  const [attempts, exams2, users2] = await Promise.all([db.collection("attempts").get(), db.collection("exams").get(), db.collection("users").get()]);
  const examMap = new Map(exams2.docs.map((doc) => [Number(doc.id), presentExam(doc.data())]));
  const userMap = new Map(users2.docs.map((doc) => [Number(doc.id), doc.data()]));
  return attempts.docs.map((doc) => presentAttempt(doc.data())).map((attempt) => ({ attemptId: attempt.id, examTitle: examMap.get(attempt.examId)?.title ?? "Assessment", studentName: userMap.get(attempt.userId)?.name ?? null, studentEmail: userMap.get(attempt.userId)?.email ?? null, score: attempt.score, maxScore: attempt.maxScore, status: attempt.status, submittedAt: attempt.submittedAt, submissionReason: attempt.submissionReason, integrityRiskScore: attempt.integrityRiskScore })).sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0));
}
async function sendSupportMessage(input) {
  const db = getFirebaseFirestore();
  const attempt = await getAttemptOwner(input.attemptId);
  if (!attempt || !canSendSupportMessage({ requesterUserId: input.senderUserId, attemptOwnerUserId: attempt.userId, attemptStatus: attempt.status, senderRole: input.senderRole })) throw new Error("Support chat is available only during your active exam attempt.");
  const ref = db.collection("attempts").doc(String(input.attemptId)).collection("support").doc();
  await ref.create({ id: ref.id, ...input, createdAt: Timestamp.now(), readAt: null });
  return { id: ref.id };
}
async function getSupportMessages(attemptId, requesterUserId, isAdmin) {
  const db = getFirebaseFirestore();
  const attempt = await getAttemptOwner(attemptId);
  if (!attempt || !canAccessAttemptReport({ requesterUserId, attemptOwnerUserId: attempt.userId, isAdmin })) throw new Error("Support conversation was not found.");
  const supportCollection = db.collection("attempts").doc(String(attemptId)).collection("support");
  const messages = await supportCollection.get();
  if (isAdmin) {
    const batch = db.batch();
    messages.docs.filter((doc) => doc.data().senderRole === "student" && !doc.data().readAt).forEach((doc) => batch.update(doc.ref, { readAt: Timestamp.now() }));
    await batch.commit();
  }
  const users2 = await Promise.all(messages.docs.map((doc) => db.collection("users").doc(String(doc.data().senderUserId)).get()));
  const nameMap = new Map(users2.filter((user) => user.exists).map((user) => [Number(user.id), user.data().name]));
  return { attempt, messages: messages.docs.map((doc) => ({ ...doc.data(), createdAt: asDate(doc.data().createdAt), readAt: asDate(doc.data().readAt), senderName: nameMap.get(Number(doc.data().senderUserId)) ?? null })).sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)) };
}
async function listSupportInbox() {
  const db = getFirebaseFirestore();
  const messages = await db.collectionGroup("support").get();
  const records = await Promise.all(messages.docs.map(async (doc) => {
    const message = doc.data();
    const attemptId = Number(message.attemptId);
    const attempt = await getAttemptOwner(attemptId);
    const [exam, student] = attempt ? await Promise.all([db.collection("exams").doc(String(attempt.examId)).get(), db.collection("users").doc(String(attempt.userId)).get()]) : [null, null];
    return { id: message.id, attemptId, senderRole: message.senderRole, message: message.message, createdAt: asDate(message.createdAt), readAt: asDate(message.readAt), examTitle: exam?.data()?.title ?? "Assessment", studentName: student?.data()?.name ?? null, studentEmail: student?.data()?.email ?? null };
  }));
  return records.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).slice(0, 100);
}
async function createAdminNotification(input) {
  const ref = getFirebaseFirestore().collection("adminNotifications").doc();
  await ref.create({ id: ref.id, ...input, relatedAttemptId: input.relatedAttemptId ?? null, createdAt: Timestamp.now(), readAt: null });
  return { id: ref.id };
}
async function listAdminNotifications() {
  const snapshot = await getFirebaseFirestore().collection("adminNotifications").get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), createdAt: asDate(doc.data().createdAt), readAt: asDate(doc.data().readAt) })).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)).slice(0, 80);
}
async function markAdminNotificationRead(notificationId) {
  await getFirebaseFirestore().collection("adminNotifications").doc(String(notificationId)).set({ readAt: Timestamp.now() }, { merge: true });
}

// server/firestoreIdentityStore.ts
import { createHash as createHash2 } from "node:crypto";
import { Timestamp as Timestamp2 } from "firebase-admin/firestore";
function lookupId(value) {
  return createHash2("sha256").update(value.trim().toLowerCase()).digest("hex");
}
function asDate2(value) {
  if (!value) return null;
  return value instanceof Timestamp2 ? value.toDate() : value;
}
function presentUser(record) {
  return {
    id: record.id,
    openId: record.openId,
    name: record.name,
    email: record.email,
    emailVerifiedAt: asDate2(record.emailVerifiedAt),
    loginMethod: record.loginMethod,
    role: record.role,
    createdAt: asDate2(record.createdAt),
    updatedAt: asDate2(record.updatedAt),
    lastSignedIn: asDate2(record.lastSignedIn)
  };
}
async function nextIdInTransaction(entity, transaction) {
  const db = getFirebaseFirestore();
  const counter = db.collection("meta").doc("counters");
  const current = await transaction.get(counter);
  const next = Number(current.data()?.[entity] ?? 0) + 1;
  transaction.set(counter, { [entity]: next }, { merge: true });
  return next;
}
async function nextId2(entity) {
  const db = getFirebaseFirestore();
  return db.runTransaction((transaction) => nextIdInTransaction(entity, transaction));
}
async function upsertUser(input) {
  if (!input.openId) throw new Error("User openId is required for upsert");
  const db = getFirebaseFirestore();
  const lookup = db.collection("userLookup").doc("openId").collection("entries").doc(lookupId(input.openId));
  const now = Timestamp2.now();
  await db.runTransaction(async (transaction) => {
    const existingLookup = await transaction.get(lookup);
    const id = existingLookup.exists ? Number(existingLookup.data().userId) : await nextIdInTransaction("users", transaction);
    const userRef = db.collection("users").doc(String(id));
    const prior = await transaction.get(userRef);
    const priorData = prior.exists ? prior.data() : void 0;
    const record = {
      id,
      openId: input.openId,
      name: input.name ?? priorData?.name ?? null,
      email: input.email ?? priorData?.email ?? null,
      loginMethod: input.loginMethod ?? priorData?.loginMethod ?? null,
      role: input.role ?? priorData?.role ?? "user",
      lastSignedIn: Timestamp2.fromDate(input.lastSignedIn ?? /* @__PURE__ */ new Date()),
      updatedAt: now
    };
    if (!prior.exists) {
      record.createdAt = now;
      record.emailVerifiedAt = null;
    }
    transaction.set(userRef, record, { merge: true });
    transaction.set(lookup, { userId: id });
    if (record.email) {
      transaction.set(db.collection("userLookup").doc("email").collection("entries").doc(lookupId(record.email)), { userId: id });
    }
  });
}
async function getUserByOpenId(openId) {
  const db = getFirebaseFirestore();
  const lookup = await db.collection("userLookup").doc("openId").collection("entries").doc(lookupId(openId)).get();
  if (!lookup.exists) return void 0;
  const record = await db.collection("users").doc(String(lookup.data().userId)).get();
  return record.exists ? presentUser(record.data()) : void 0;
}
async function getUserById(userId) {
  const record = await getFirebaseFirestore().collection("users").doc(String(userId)).get();
  return record.exists ? presentUser(record.data()) : null;
}
async function getStudentProfile(userId) {
  const record = await getFirebaseFirestore().collection("users").doc(String(userId)).get();
  if (!record.exists) return null;
  const user = record.data();
  if (!user.profile) return null;
  return { id: userId, userId, ...user.profile, createdAt: asDate2(user.createdAt), updatedAt: asDate2(user.updatedAt) };
}
async function upsertStudentProfile(input) {
  const db = getFirebaseFirestore();
  await db.collection("users").doc(String(input.userId)).set(
    {
      profile: { fullName: input.fullName, collegeName: input.collegeName ?? null, rollNumber: input.rollNumber ?? null },
      updatedAt: Timestamp2.now()
    },
    { merge: true }
  );
  return getStudentProfile(input.userId);
}
async function createLocalStudent(input) {
  const db = getFirebaseFirestore();
  const emailLookup = db.collection("userLookup").doc("email").collection("entries").doc(lookupId(input.email));
  const openIdLookup = db.collection("userLookup").doc("openId").collection("entries").doc(lookupId(input.openId));
  return db.runTransaction(async (transaction) => {
    const existing = await transaction.get(emailLookup);
    if (existing.exists) throw new Error("An account already exists for this email address.");
    const id = await nextIdInTransaction("users", transaction);
    const now = Timestamp2.now();
    const record = {
      id,
      openId: input.openId,
      name: input.fullName,
      email: input.email,
      emailVerifiedAt: null,
      loginMethod: "local",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      profile: { fullName: input.fullName, collegeName: input.collegeName ?? null, rollNumber: input.rollNumber ?? null },
      passwordHash: input.passwordHash
    };
    transaction.create(db.collection("users").doc(String(id)), record);
    transaction.create(emailLookup, { userId: id });
    transaction.create(openIdLookup, { userId: id });
    return { id };
  });
}
async function findLocalCredentialByEmail(email) {
  const db = getFirebaseFirestore();
  const lookup = await db.collection("userLookup").doc("email").collection("entries").doc(lookupId(email)).get();
  if (!lookup.exists) return null;
  const user = await db.collection("users").doc(String(lookup.data().userId)).get();
  if (!user.exists) return null;
  const data = user.data();
  if (!data.passwordHash) return null;
  return { userId: data.id, passwordHash: data.passwordHash, role: data.role, email: data.email, name: data.name, emailVerifiedAt: asDate2(data.emailVerifiedAt) };
}
async function findLocalAccountByEmail(email) {
  const user = await findLocalCredentialByEmail(email);
  return user ? { userId: user.userId, email: user.email, emailVerifiedAt: user.emailVerifiedAt, fullName: user.name } : null;
}
async function createAccountToken(userId, purpose, tokenHash, expiresAt) {
  const db = getFirebaseFirestore();
  await db.collection("accountTokens").doc(tokenHash).create({ userId, purpose, tokenHash, expiresAt: Timestamp2.fromDate(expiresAt), consumedAt: null, createdAt: Timestamp2.now() });
  return { id: tokenHash };
}
async function consumeAccountToken(tokenHash, purpose) {
  const db = getFirebaseFirestore();
  const ref = db.collection("accountTokens").doc(tokenHash);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return null;
    const token = snapshot.data();
    if (token.purpose !== purpose || token.consumedAt || token.expiresAt.toDate() <= /* @__PURE__ */ new Date()) return null;
    transaction.update(ref, { consumedAt: Timestamp2.now() });
    return { id: tokenHash, userId: token.userId, purpose: token.purpose, expiresAt: token.expiresAt.toDate(), consumedAt: null };
  });
}
async function markEmailVerified(userId) {
  await getFirebaseFirestore().collection("users").doc(String(userId)).set({ emailVerifiedAt: Timestamp2.now(), updatedAt: Timestamp2.now() }, { merge: true });
}
async function replaceLocalPassword(userId, passwordHash) {
  await getFirebaseFirestore().collection("users").doc(String(userId)).set({ passwordHash, updatedAt: Timestamp2.now() }, { merge: true });
}
async function touchUserSignIn(userId) {
  await getFirebaseFirestore().collection("users").doc(String(userId)).set({ lastSignedIn: Timestamp2.now(), updatedAt: Timestamp2.now() }, { merge: true });
}
async function ensureConfiguredAdmin(openId) {
  const existing = await getUserByOpenId(openId);
  if (existing) {
    await getFirebaseFirestore().collection("users").doc(String(existing.id)).set({ role: "admin", loginMethod: "configured-admin", lastSignedIn: Timestamp2.now(), updatedAt: Timestamp2.now() }, { merge: true });
    return await getUserById(existing.id);
  }
  const id = await nextId2("users");
  const now = Timestamp2.now();
  await getFirebaseFirestore().collection("users").doc(String(id)).create({ id, openId, name: "ProctorX Administrator", email: null, emailVerifiedAt: null, loginMethod: "configured-admin", role: "admin", createdAt: now, updatedAt: now, lastSignedIn: now });
  await getFirebaseFirestore().collection("userLookup").doc("openId").collection("entries").doc(lookupId(openId)).set({ userId: id });
  return await getUserById(id);
}
async function listManagedUsers() {
  const snapshot = await getFirebaseFirestore().collection("users").orderBy("createdAt", "desc").get();
  return snapshot.docs.map((document) => {
    const data = document.data();
    return { ...presentUser(data), fullName: data.profile?.fullName ?? null, collegeName: data.profile?.collegeName ?? null, rollNumber: data.profile?.rollNumber ?? null };
  });
}
async function updateManagedUser(actorUserId, input) {
  const db = getFirebaseFirestore();
  const ref = db.collection("users").doc(String(input.userId));
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error("User record was not found.");
  await ref.set({ name: input.fullName, role: input.role, profile: { fullName: input.fullName, collegeName: input.collegeName ?? null, rollNumber: input.rollNumber ?? null }, updatedAt: Timestamp2.now() }, { merge: true });
  await db.collection("auditLogs").add({ actorUserId, action: "identity.updated", entityType: "user", entityId: input.userId, metadata: { role: input.role }, createdAt: Timestamp2.now() });
  return getUserById(input.userId);
}

// server/db.ts
var _db = null;
function useFirestorePersistence() {
  return isFirebaseAdminConfigured() && !process.env.DATABASE_URL;
}
async function getDb() {
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
async function upsertUser2(user) {
  if (useFirestorePersistence()) return upsertUser(user);
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await requireDb();
  const values = { openId: user.openId };
  const updateSet = {};
  for (const field of ["name", "email", "loginMethod"]) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.lastSignedIn = user.lastSignedIn ?? /* @__PURE__ */ new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId2(openId) {
  if (useFirestorePersistence()) return getUserByOpenId(openId);
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function getStudentProfile2(userId) {
  if (useFirestorePersistence()) return getStudentProfile(userId);
  const db = await requireDb();
  const profile = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
  return profile[0] ?? null;
}
async function upsertStudentProfile2(input) {
  if (useFirestorePersistence()) return upsertStudentProfile(input);
  const db = await requireDb();
  await db.insert(studentProfiles).values(input).onDuplicateKeyUpdate({
    set: {
      fullName: input.fullName,
      collegeName: input.collegeName ?? null,
      rollNumber: input.rollNumber ?? null
    }
  });
  return getStudentProfile2(input.userId);
}
async function getStudentOverview2(userId) {
  if (useFirestorePersistence()) return getStudentOverview(userId);
  const db = await requireDb();
  const [profile, availableExams, attempts] = await Promise.all([
    getStudentProfile2(userId),
    db.select({
      id: exams.id,
      title: exams.title,
      description: exams.description,
      durationSeconds: exams.durationSeconds,
      startsAt: exams.startsAt,
      endsAt: exams.endsAt,
      status: exams.status,
      proctoringConfig: exams.proctoringConfig
    }).from(exams).where(sql`${exams.status} in ('scheduled', 'live')`).orderBy(asc(exams.startsAt)).limit(30),
    db.select({
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
      releaseResultsImmediately: exams.releaseResultsImmediately
    }).from(examAttempts).innerJoin(exams, eq(examAttempts.examId, exams.id)).where(eq(examAttempts.userId, userId)).orderBy(desc(examAttempts.startedAt)).limit(30)
  ]);
  return { profile, availableExams, attempts };
}
async function startExamAttempt2(userId, examId) {
  if (useFirestorePersistence()) {
    const created2 = await startExamAttempt(userId, examId);
    await writeAuditLog(userId, "attempt.started", "examAttempt", created2.id, { examId });
    return created2;
  }
  const db = await requireDb();
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam || !["scheduled", "live"].includes(exam.status)) throw new Error("This exam is not available.");
  const now = /* @__PURE__ */ new Date();
  if (exam.startsAt && exam.startsAt > now || exam.endsAt && exam.endsAt < now) {
    throw new Error("This exam is outside its scheduled window.");
  }
  const [existing] = await db.select({ id: examAttempts.id }).from(examAttempts).where(and(eq(examAttempts.userId, userId), eq(examAttempts.examId, examId), eq(examAttempts.status, "in_progress"))).limit(1);
  if (existing) return existing;
  const priorAttempts = await db.select({ id: examAttempts.id }).from(examAttempts).where(and(eq(examAttempts.userId, userId), eq(examAttempts.examId, examId)));
  if (priorAttempts.length >= exam.maxAttempts) throw new Error("The maximum number of attempts has been reached.");
  const [created] = await db.insert(examAttempts).values({ examId, userId }).$returningId();
  await writeAuditLog2(userId, "attempt.started", "examAttempt", created.id, { examId });
  return created;
}
async function getStudentAttempt2(userId, attemptId) {
  if (useFirestorePersistence()) return getStudentAttempt(userId, attemptId);
  const db = await requireDb();
  const [attempt] = await db.select({
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
    proctoringConfig: exams.proctoringConfig
  }).from(examAttempts).innerJoin(exams, eq(examAttempts.examId, exams.id)).where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId))).limit(1);
  if (!attempt) return null;
  const [questionRows, answerRows, eventRows] = await Promise.all([
    db.select({
      id: questions.id,
      prompt: questions.prompt,
      optionA: questions.optionA,
      optionB: questions.optionB,
      optionC: questions.optionC,
      optionD: questions.optionD,
      points: questions.points,
      orderIndex: questions.orderIndex
    }).from(questions).where(eq(questions.examId, attempt.examId)).orderBy(asc(questions.orderIndex)),
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId)),
    db.select({ id: proctoringEvents.id, eventType: proctoringEvents.eventType, severity: proctoringEvents.severity, detectedAt: proctoringEvents.detectedAt, durationMs: proctoringEvents.durationMs }).from(proctoringEvents).where(eq(proctoringEvents.attemptId, attemptId)).orderBy(desc(proctoringEvents.detectedAt))
  ]);
  return { attempt, questions: questionRows, answers: answerRows, events: eventRows };
}
async function saveAttemptAnswer2(userId, input) {
  if (useFirestorePersistence()) return saveAttemptAnswer(userId, input);
  const db = await requireDb();
  const [attempt] = await db.select({ id: examAttempts.id, examId: examAttempts.examId, status: examAttempts.status }).from(examAttempts).where(and(eq(examAttempts.id, input.attemptId), eq(examAttempts.userId, userId))).limit(1);
  if (!attempt || attempt.status !== "in_progress") throw new Error("This exam attempt is no longer editable.");
  const [question] = await db.select({ id: questions.id }).from(questions).where(and(eq(questions.id, input.questionId), eq(questions.examId, attempt.examId))).limit(1);
  if (!question) throw new Error("The selected question does not belong to this exam.");
  await db.insert(attemptAnswers).values({
    attemptId: input.attemptId,
    questionId: input.questionId,
    selectedOption: input.selectedOption,
    markedForReview: input.markedForReview ? 1 : 0,
    answeredAt: input.selectedOption ? /* @__PURE__ */ new Date() : null
  }).onDuplicateKeyUpdate({
    set: {
      selectedOption: input.selectedOption,
      markedForReview: input.markedForReview ? 1 : 0,
      answeredAt: input.selectedOption ? /* @__PURE__ */ new Date() : null
    }
  });
  await db.update(examAttempts).set({ lastActivityAt: /* @__PURE__ */ new Date() }).where(eq(examAttempts.id, input.attemptId));
  return { success: true };
}
async function submitExamAttempt2(userId, attemptId, reason) {
  if (useFirestorePersistence()) {
    const result2 = await submitExamAttempt(userId, attemptId, reason);
    await writeAuditLog(userId, "attempt.submitted", "examAttempt", attemptId, { reason, score: result2.score, maxScore: result2.maxScore });
    return result2;
  }
  const db = await requireDb();
  const [attempt] = await db.select({ id: examAttempts.id, examId: examAttempts.examId, status: examAttempts.status }).from(examAttempts).where(and(eq(examAttempts.id, attemptId), eq(examAttempts.userId, userId))).limit(1);
  if (!attempt) throw new Error("Exam attempt was not found.");
  if (attempt.status !== "in_progress") {
    const [completed] = await db.select().from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1);
    return completed;
  }
  const [questionRows, answerRows] = await Promise.all([
    db.select({ id: questions.id, correctOption: questions.correctOption, points: questions.points }).from(questions).where(eq(questions.examId, attempt.examId)),
    db.select().from(attemptAnswers).where(eq(attemptAnswers.attemptId, attemptId))
  ]);
  const selectedAnswers = new Map(answerRows.map((answer) => [answer.questionId, answer.selectedOption]));
  const result = calculateExamScore(
    questionRows.map((question) => ({ ...question, correctOption: question.correctOption })),
    selectedAnswers
  );
  await db.transaction(async (tx) => {
    for (const answer of answerRows) {
      const question = questionRows.find((row) => row.id === answer.questionId);
      await tx.update(attemptAnswers).set({ isCorrect: question && answer.selectedOption === question.correctOption ? 1 : 0 }).where(eq(attemptAnswers.id, answer.id));
    }
    await tx.update(examAttempts).set({
      status: "submitted",
      submittedAt: /* @__PURE__ */ new Date(),
      submissionReason: reason,
      score: result.score,
      maxScore: result.maxScore,
      lastActivityAt: /* @__PURE__ */ new Date()
    }).where(eq(examAttempts.id, attemptId));
  });
  await writeAuditLog2(userId, "attempt.submitted", "examAttempt", attemptId, { reason, ...result });
  return { id: attemptId, ...result, reason };
}
async function reopenExamAttempt2(adminUserId, attemptId, basis, note) {
  if (useFirestorePersistence()) return reopenExamAttempt(adminUserId, attemptId, basis, note);
  const db = await requireDb();
  const [attempt] = await db.select({ id: examAttempts.id, status: examAttempts.status }).from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1);
  if (!attempt) throw new Error("Exam attempt was not found.");
  if (attempt.status === "in_progress") throw new Error("This attempt is already active.");
  const priorEvents = await db.select({ eventType: proctoringEvents.eventType, severity: proctoringEvents.severity, durationMs: proctoringEvents.durationMs, detectedAt: proctoringEvents.detectedAt }).from(proctoringEvents).where(eq(proctoringEvents.attemptId, attemptId));
  const now = /* @__PURE__ */ new Date();
  await db.transaction(async (tx) => {
    await tx.delete(proctoringEvents).where(eq(proctoringEvents.attemptId, attemptId));
    await tx.update(examAttempts).set({ status: "in_progress", startedAt: now, submittedAt: null, submissionReason: null, score: null, maxScore: null, integrityRiskScore: 0, lastActivityAt: now }).where(eq(examAttempts.id, attemptId));
  });
  await writeAuditLog2(adminUserId, "attempt.reopened", "examAttempt", attemptId, {
    basis,
    note,
    clearedIntegrityEventCount: priorEvents.length,
    clearedIntegrityEvents: priorEvents.map((event) => ({ ...event, detectedAt: event.detectedAt.toISOString() }))
  });
  return { id: attemptId, status: "in_progress" };
}
async function recordProctoringEvent2(userId, input) {
  if (useFirestorePersistence()) return recordProctoringEvent(userId, input);
  const db = await requireDb();
  const [attempt] = await db.select({ id: examAttempts.id, status: examAttempts.status, proctoringConfig: exams.proctoringConfig }).from(examAttempts).innerJoin(exams, eq(examAttempts.examId, exams.id)).where(and(eq(examAttempts.id, input.attemptId), eq(examAttempts.userId, userId))).limit(1);
  if (!attempt || attempt.status !== "in_progress") throw new Error("This exam attempt is not accepting integrity events.");
  const config = normalizeProctoringConfig(attempt.proctoringConfig);
  const [existingCount] = await db.select({ count: sql`count(*)` }).from(proctoringEvents).where(eq(proctoringEvents.attemptId, input.attemptId));
  const eventCount = Number(existingCount?.count ?? 0) + 1;
  const severity = eventCount >= config.autoSubmitEventCount ? "critical" : eventCount >= config.warningEventCount ? "warning" : "info";
  await db.insert(proctoringEvents).values({ ...input, severity });
  await db.update(examAttempts).set({ integrityRiskScore: eventCount, lastActivityAt: /* @__PURE__ */ new Date() }).where(eq(examAttempts.id, input.attemptId));
  return { eventCount, proctoringConfig: config };
}
async function listAdminExams2() {
  if (useFirestorePersistence()) return listAdminExams();
  const db = await requireDb();
  return db.select({
    id: exams.id,
    title: exams.title,
    description: exams.description,
    durationSeconds: exams.durationSeconds,
    startsAt: exams.startsAt,
    endsAt: exams.endsAt,
    status: exams.status,
    maxAttempts: exams.maxAttempts,
    createdAt: exams.createdAt
  }).from(exams).orderBy(desc(exams.createdAt));
}
async function getAdminExam2(examId) {
  if (useFirestorePersistence()) return getAdminExam(examId);
  const db = await requireDb();
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return null;
  const examQuestions = await db.select().from(questions).where(eq(questions.examId, examId)).orderBy(asc(questions.orderIndex));
  return { exam, questions: examQuestions };
}
async function createExam2(adminUserId, input) {
  if (useFirestorePersistence()) return createExam(adminUserId, input);
  const db = await requireDb();
  const [created] = await db.insert(exams).values({
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
    proctoringConfig: normalizeProctoringConfig(input.proctoringConfig)
  }).$returningId();
  await db.insert(questions).values(
    input.questions.map((question, index2) => ({ ...question, examId: created.id, orderIndex: index2 }))
  );
  await writeAuditLog2(adminUserId, "exam.created", "exam", created.id, { questionCount: input.questions.length });
  return { id: created.id };
}
async function updateExam2(adminUserId, examId, input) {
  if (useFirestorePersistence()) return updateExam(adminUserId, examId, input);
  const db = await requireDb();
  const [exam] = await db.select({ id: exams.id }).from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) throw new Error("Assessment was not found.");
  const [attemptCount] = await db.select({ count: sql`count(*)` }).from(examAttempts).where(eq(examAttempts.examId, examId));
  if (Number(attemptCount?.count ?? 0) > 0) {
    throw new Error("Assessments with recorded attempts cannot have their questions or settings changed.");
  }
  await db.transaction(async (tx) => {
    await tx.update(exams).set({
      title: input.title,
      description: input.description ?? null,
      durationSeconds: input.durationSeconds,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      status: input.status,
      maxAttempts: input.maxAttempts,
      shuffleQuestions: input.shuffleQuestions ? 1 : 0,
      releaseResultsImmediately: input.releaseResultsImmediately ? 1 : 0,
      proctoringConfig: normalizeProctoringConfig(input.proctoringConfig)
    }).where(eq(exams.id, examId));
    await tx.delete(questions).where(eq(questions.examId, examId));
    await tx.insert(questions).values(input.questions.map((question, index2) => ({ ...question, examId, orderIndex: index2 })));
  });
  await writeAuditLog2(adminUserId, "exam.updated", "exam", examId, { questionCount: input.questions.length });
  return { id: examId };
}
async function getAttemptReview2(attemptId) {
  if (useFirestorePersistence()) return getAttemptReview(attemptId);
  const db = await requireDb();
  const [attempt] = await db.select({
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
    collegeName: studentProfiles.collegeName
  }).from(examAttempts).innerJoin(exams, eq(examAttempts.examId, exams.id)).innerJoin(users, eq(examAttempts.userId, users.id)).leftJoin(studentProfiles, eq(examAttempts.userId, studentProfiles.userId)).where(eq(examAttempts.id, attemptId)).limit(1);
  if (!attempt) return null;
  const [answers, events] = await Promise.all([
    db.select({
      questionId: questions.id,
      prompt: questions.prompt,
      selectedOption: attemptAnswers.selectedOption,
      correctOption: questions.correctOption,
      isCorrect: attemptAnswers.isCorrect,
      markedForReview: attemptAnswers.markedForReview
    }).from(questions).leftJoin(attemptAnswers, and(eq(attemptAnswers.questionId, questions.id), eq(attemptAnswers.attemptId, attemptId))).where(eq(questions.examId, (await db.select({ examId: examAttempts.examId }).from(examAttempts).where(eq(examAttempts.id, attemptId)).limit(1))[0].examId)).orderBy(asc(questions.orderIndex)),
    db.select().from(proctoringEvents).where(eq(proctoringEvents.attemptId, attemptId)).orderBy(desc(proctoringEvents.detectedAt))
  ]);
  return { attempt, answers, events };
}
async function getResultsExport2() {
  if (useFirestorePersistence()) return getResultsExport();
  const db = await requireDb();
  return db.select({
    attemptId: examAttempts.id,
    examTitle: exams.title,
    studentName: users.name,
    studentEmail: users.email,
    score: examAttempts.score,
    maxScore: examAttempts.maxScore,
    status: examAttempts.status,
    submittedAt: examAttempts.submittedAt,
    submissionReason: examAttempts.submissionReason,
    integrityRiskScore: examAttempts.integrityRiskScore
  }).from(examAttempts).innerJoin(exams, eq(examAttempts.examId, exams.id)).innerJoin(users, eq(examAttempts.userId, users.id)).orderBy(desc(examAttempts.submittedAt));
}
async function writeAuditLog2(actorUserId, action, entityType, entityId, metadata) {
  if (useFirestorePersistence()) return writeAuditLog(actorUserId, action, entityType, entityId, metadata);
  const db = await requireDb();
  await db.insert(examAuditLogs).values({ actorUserId, action, entityType, entityId, metadata });
}
async function createLocalStudent2(input) {
  if (useFirestorePersistence()) return createLocalStudent(input);
  const db = await requireDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
  if (existing[0]) throw new Error("An account already exists for this email address.");
  const [created] = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ openId: input.openId, name: input.fullName, email: input.email, loginMethod: "local", role: "user" }).$returningId();
    await tx.insert(studentProfiles).values({ userId: user.id, fullName: input.fullName, collegeName: input.collegeName ?? null, rollNumber: input.rollNumber ?? null });
    await tx.insert(localCredentials).values({ userId: user.id, passwordHash: input.passwordHash });
    return [user];
  });
  return created;
}
async function findLocalCredentialByEmail2(email) {
  if (useFirestorePersistence()) return findLocalCredentialByEmail(email);
  const db = await requireDb();
  const [record] = await db.select({ userId: users.id, passwordHash: localCredentials.passwordHash, role: users.role, email: users.email, name: users.name, emailVerifiedAt: users.emailVerifiedAt }).from(users).innerJoin(localCredentials, eq(localCredentials.userId, users.id)).where(eq(users.email, email)).limit(1);
  return record ?? null;
}
async function findLocalAccountByEmail2(email) {
  if (useFirestorePersistence()) return findLocalAccountByEmail(email);
  const db = await requireDb();
  const [account] = await db.select({ userId: users.id, email: users.email, emailVerifiedAt: users.emailVerifiedAt, fullName: users.name }).from(users).innerJoin(localCredentials, eq(localCredentials.userId, users.id)).where(eq(users.email, email)).limit(1);
  return account ?? null;
}
async function createAccountToken2(userId, purpose, tokenHash, expiresAt) {
  if (useFirestorePersistence()) return createAccountToken(userId, purpose, tokenHash, expiresAt);
  const db = await requireDb();
  const [created] = await db.insert(accountTokens).values({ userId, purpose, tokenHash, expiresAt }).$returningId();
  return created;
}
async function consumeAccountToken2(tokenHash, purpose) {
  if (useFirestorePersistence()) return consumeAccountToken(tokenHash, purpose);
  const db = await requireDb();
  const [token] = await db.select().from(accountTokens).where(and(eq(accountTokens.tokenHash, tokenHash), eq(accountTokens.purpose, purpose))).limit(1);
  if (!token || token.consumedAt || token.expiresAt <= /* @__PURE__ */ new Date()) return null;
  const result = await db.update(accountTokens).set({ consumedAt: /* @__PURE__ */ new Date() }).where(and(eq(accountTokens.id, token.id), sql`${accountTokens.consumedAt} is null`, sql`${accountTokens.expiresAt} > now()`));
  if (!didConsumeTokenExactlyOnce(getAffectedRowCount(result))) return null;
  return token;
}
async function markEmailVerified2(userId) {
  if (useFirestorePersistence()) return markEmailVerified(userId);
  const db = await requireDb();
  await db.update(users).set({ emailVerifiedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
}
async function replaceLocalPassword2(userId, passwordHash) {
  if (useFirestorePersistence()) return replaceLocalPassword(userId, passwordHash);
  const db = await requireDb();
  await db.update(localCredentials).set({ passwordHash }).where(eq(localCredentials.userId, userId));
}
async function getUserById2(userId) {
  if (useFirestorePersistence()) return getUserById(userId);
  const db = await requireDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}
async function touchUserSignIn2(userId) {
  if (useFirestorePersistence()) return touchUserSignIn(userId);
  const db = await requireDb();
  await db.update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
}
async function ensureConfiguredAdmin2(openId) {
  if (useFirestorePersistence()) return ensureConfiguredAdmin(openId);
  const db = await requireDb();
  const [existing] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (existing) {
    await db.update(users).set({ role: "admin", loginMethod: "configured-admin", lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, existing.id));
    return await getUserById2(existing.id);
  }
  const [created] = await db.insert(users).values({ openId, name: "ProctorX Administrator", email: null, loginMethod: "configured-admin", role: "admin" }).$returningId();
  return await getUserById2(created.id);
}
async function listManagedUsers2() {
  if (useFirestorePersistence()) return listManagedUsers();
  const db = await requireDb();
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    loginMethod: users.loginMethod,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
    fullName: studentProfiles.fullName,
    collegeName: studentProfiles.collegeName,
    rollNumber: studentProfiles.rollNumber
  }).from(users).leftJoin(studentProfiles, eq(studentProfiles.userId, users.id)).orderBy(desc(users.createdAt));
}
async function updateManagedUser2(actorUserId, input) {
  if (useFirestorePersistence()) return updateManagedUser(actorUserId, input);
  const db = await requireDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1);
  if (!user) throw new Error("User record was not found.");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ name: input.fullName, role: input.role }).where(eq(users.id, input.userId));
    await tx.insert(studentProfiles).values({ userId: input.userId, fullName: input.fullName, collegeName: input.collegeName ?? null, rollNumber: input.rollNumber ?? null }).onDuplicateKeyUpdate({ set: { fullName: input.fullName, collegeName: input.collegeName ?? null, rollNumber: input.rollNumber ?? null } });
  });
  await writeAuditLog2(actorUserId, "identity.updated", "user", input.userId, { role: input.role });
  return getUserById2(input.userId);
}
async function getAttemptOwner2(attemptId) {
  const db = await requireDb();
  const [attempt] = await db.select({ id: examAttempts.id, userId: examAttempts.userId, status: examAttempts.status, examTitle: exams.title }).from(examAttempts).innerJoin(exams, eq(examAttempts.examId, exams.id)).where(eq(examAttempts.id, attemptId)).limit(1);
  return attempt ?? null;
}
async function sendSupportMessage2(input) {
  if (useFirestorePersistence()) return sendSupportMessage(input);
  const db = await requireDb();
  const attempt = await getAttemptOwner2(input.attemptId);
  if (!attempt) throw new Error("Exam attempt was not found.");
  if (!canSendSupportMessage({ requesterUserId: input.senderUserId, attemptOwnerUserId: attempt.userId, attemptStatus: attempt.status, senderRole: input.senderRole })) {
    throw new Error("Support chat is available only during your active exam attempt.");
  }
  const [created] = await db.insert(supportMessages).values(input).$returningId();
  return created;
}
async function getSupportMessages2(attemptId, requesterUserId, isAdmin) {
  if (useFirestorePersistence()) return getSupportMessages(attemptId, requesterUserId, isAdmin);
  const db = await requireDb();
  const attempt = await getAttemptOwner2(attemptId);
  if (!attempt || !canAccessAttemptReport({ requesterUserId, attemptOwnerUserId: attempt.userId, isAdmin })) throw new Error("Support conversation was not found.");
  if (isAdmin) {
    await db.update(supportMessages).set({ readAt: /* @__PURE__ */ new Date() }).where(and(eq(supportMessages.attemptId, attemptId), eq(supportMessages.senderRole, "student")));
  }
  const messages = await db.select({ id: supportMessages.id, senderUserId: supportMessages.senderUserId, senderRole: supportMessages.senderRole, message: supportMessages.message, createdAt: supportMessages.createdAt, readAt: supportMessages.readAt, senderName: users.name }).from(supportMessages).innerJoin(users, eq(supportMessages.senderUserId, users.id)).where(eq(supportMessages.attemptId, attemptId)).orderBy(asc(supportMessages.createdAt));
  return { attempt, messages };
}
async function listSupportInbox2() {
  if (useFirestorePersistence()) return listSupportInbox();
  const db = await requireDb();
  return db.select({
    id: supportMessages.id,
    attemptId: supportMessages.attemptId,
    senderRole: supportMessages.senderRole,
    message: supportMessages.message,
    createdAt: supportMessages.createdAt,
    readAt: supportMessages.readAt,
    examTitle: exams.title,
    studentName: users.name,
    studentEmail: users.email
  }).from(supportMessages).innerJoin(examAttempts, eq(supportMessages.attemptId, examAttempts.id)).innerJoin(exams, eq(examAttempts.examId, exams.id)).innerJoin(users, eq(examAttempts.userId, users.id)).orderBy(desc(supportMessages.createdAt)).limit(100);
}
async function createAdminNotification2(input) {
  if (useFirestorePersistence()) return createAdminNotification(input);
  const db = await requireDb();
  const [created] = await db.insert(adminNotifications).values({ ...input, relatedAttemptId: input.relatedAttemptId ?? null }).$returningId();
  return created;
}
async function listAdminNotifications2() {
  if (useFirestorePersistence()) return listAdminNotifications();
  const db = await requireDb();
  return db.select().from(adminNotifications).orderBy(desc(adminNotifications.createdAt)).limit(80);
}
async function markAdminNotificationRead2(notificationId) {
  if (useFirestorePersistence()) return markAdminNotificationRead(notificationId);
  const db = await requireDb();
  await db.update(adminNotifications).set({ readAt: /* @__PURE__ */ new Date() }).where(eq(adminNotifications.id, notificationId));
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId2(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser2({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId2(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser2({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser2({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/localSession.ts
import { parse } from "cookie";
import { jwtVerify as jwtVerify2, SignJWT as SignJWT2 } from "jose";
var LOCAL_SESSION_COOKIE = "proctorx_local_session";
var SESSION_LIFETIME_SECONDS = 60 * 60 * 12;
function getSecret() {
  const source = process.env.JWT_SECRET;
  if (!source) throw new Error("Local credential sessions are unavailable because the session secret is missing.");
  return new TextEncoder().encode(source);
}
async function issueLocalSession(req, res, userId) {
  const token = await new SignJWT2({ authType: "local" }).setProtectedHeader({ alg: "HS256" }).setSubject(String(userId)).setIssuedAt().setExpirationTime(`${SESSION_LIFETIME_SECONDS}s`).sign(getSecret());
  res.cookie(LOCAL_SESSION_COOKIE, token, { ...getSessionCookieOptions(req), maxAge: SESSION_LIFETIME_SECONDS * 1e3 });
}
async function getLocalSessionUserId(req) {
  const token = parse(req.headers.cookie ?? "")[LOCAL_SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify2(token, getSecret(), { algorithms: ["HS256"] });
    if (payload.authType !== "local" || !payload.sub || !/^\d+$/.test(payload.sub)) return null;
    return Number(payload.sub);
  } catch {
    return null;
  }
}
function clearLocalSession(req, res) {
  res.clearCookie(LOCAL_SESSION_COOKIE, { ...getSessionCookieOptions(req), maxAge: -1 });
}

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    const localUserId = await getLocalSessionUserId(opts.req);
    user = localUserId ? await getUserById2(localUserId) : await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  firebaseReadiness: adminProcedure.query(async () => {
    if (!isFirebaseAdminConfigured()) {
      return { configured: false, reachable: false };
    }
    try {
      await getFirebaseFirestore().listCollections();
      return { configured: true, reachable: true };
    } catch (error) {
      console.error("[Firebase] Admin readiness check failed", error);
      return { configured: true, reachable: false };
    }
  }),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/proctorx.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z as z2 } from "zod";

// server/localAuth.ts
import { createHash as createHash3, randomBytes as randomBytes2, scryptSync, timingSafeEqual } from "node:crypto";
function equalSecret(value, configured) {
  const left = Buffer.from(value);
  const right = Buffer.from(configured);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
function hashPassword(password) {
  const salt = randomBytes2(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(password, encoded) {
  const [algorithm, salt, hash] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64).toString("hex");
  return equalSecret(candidate, hash);
}
function verifyConfiguredAdminCredentials(loginId, password) {
  const configuredId = process.env.ADMIN_LOGIN_ID ?? "";
  const configuredPassword = process.env.ADMIN_LOGIN_PASSWORD ?? "";
  if (!configuredId || !configuredPassword) return false;
  return equalSecret(loginId, configuredId) && equalSecret(password, configuredPassword);
}
function getConfiguredAdminOpenId(loginId) {
  return `admin:${createHash3("sha256").update(loginId).digest("hex").slice(0, 56)}`;
}

// server/supportRealtime.ts
function notifySupportConversation(attemptId) {
  void attemptId;
}
function notifyAdministrators() {
}

// server/transactionalEmail.ts
async function deliverAccountLink(input) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (apiKey && from) {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>${input.heading}</h1><p>${input.description}</p><p><a href="${input.link}">Continue securely</a></p><p>This link expires automatically and can be used once.</p></main>` }) });
    if (!response.ok) throw new Error("Email delivery could not be completed. Please try again later.");
    return { mode: "sent" };
  }
  return process.env.NODE_ENV === "production" ? { mode: "configuration_required" } : { mode: "preview", previewUrl: input.link };
}

// server/proctorx.ts
var answerOptionSchema = z2.enum(["A", "B", "C", "D"]);
var proctoringConfigSchema = z2.object({
  faceAbsentThresholdSeconds: z2.number().int().min(1).max(120).default(DEFAULT_PROCTORING_CONFIG.faceAbsentThresholdSeconds),
  multipleFaceThresholdSeconds: z2.number().int().min(1).max(120).default(DEFAULT_PROCTORING_CONFIG.multipleFaceThresholdSeconds),
  warningEventCount: z2.number().int().min(1).max(50).default(DEFAULT_PROCTORING_CONFIG.warningEventCount),
  autoSubmitEventCount: z2.number().int().min(2).max(100).default(DEFAULT_PROCTORING_CONFIG.autoSubmitEventCount),
  immediateSubmitOnFocusLoss: z2.boolean().default(DEFAULT_PROCTORING_CONFIG.immediateSubmitOnFocusLoss),
  audioMonitoringEnabled: z2.boolean().default(DEFAULT_PROCTORING_CONFIG.audioMonitoringEnabled),
  audioActivityThresholdSeconds: z2.number().int().min(1).max(120).default(DEFAULT_PROCTORING_CONFIG.audioActivityThresholdSeconds),
  audioActivityLevel: z2.number().int().min(1).max(127).default(DEFAULT_PROCTORING_CONFIG.audioActivityLevel),
  immediateSubmitOnAudioActivity: z2.boolean().default(DEFAULT_PROCTORING_CONFIG.immediateSubmitOnAudioActivity)
});
var questionInputSchema = z2.object({
  prompt: z2.string().trim().min(4).max(3e3),
  optionA: z2.string().trim().min(1).max(1e3),
  optionB: z2.string().trim().min(1).max(1e3),
  optionC: z2.string().trim().min(1).max(1e3),
  optionD: z2.string().trim().min(1).max(1e3),
  correctOption: answerOptionSchema,
  points: z2.number().int().min(1).max(100).default(1)
});
async function sendAccountLink(input) {
  const token = createAccountTokenValue();
  await createAccountToken2(input.userId, input.purpose, hashAccountToken(token), getTokenExpiry(input.purpose));
  const path = input.purpose === "verify_email" ? "/verify-email" : "/reset-password";
  return deliverAccountLink({
    to: input.email,
    subject: input.purpose === "verify_email" ? "Verify your ProctorX email" : "Reset your ProctorX password",
    heading: input.purpose === "verify_email" ? "Verify your account" : "Reset your password",
    description: input.purpose === "verify_email" ? "Confirm your email address to activate your ProctorX student account." : "Choose a new password for your ProctorX account.",
    link: `${input.origin}${path}?token=${encodeURIComponent(token)}`
  });
}
var examInputSchema = z2.object({
  title: z2.string().trim().min(3).max(255),
  description: z2.string().trim().max(5e3).nullable().optional(),
  durationSeconds: z2.number().int().min(60).max(43200),
  startsAt: z2.date().nullable().optional(),
  endsAt: z2.date().nullable().optional(),
  status: z2.enum(["draft", "scheduled", "live", "closed", "archived"]).default("draft"),
  maxAttempts: z2.number().int().min(1).max(10).default(1),
  shuffleQuestions: z2.boolean().default(false),
  releaseResultsImmediately: z2.boolean().default(true),
  proctoringConfig: proctoringConfigSchema.default(DEFAULT_PROCTORING_CONFIG),
  questions: z2.array(questionInputSchema).min(1).max(100)
}).refine((value) => !value.startsAt || !value.endsAt || value.startsAt < value.endsAt, {
  message: "The end time must be later than the start time.",
  path: ["endsAt"]
});
var proctorxRouter = router({
  credentials: router({
    signUp: publicProcedure.input(z2.object({ fullName: z2.string().trim().min(2).max(255), email: z2.string().trim().email().max(320), password: z2.string().min(10).max(128), collegeName: z2.string().trim().max(255).nullable().optional(), rollNumber: z2.string().trim().max(128).nullable().optional(), origin: z2.string().url() })).mutation(async ({ ctx, input }) => {
      const email = input.email.toLowerCase();
      const user = await createLocalStudent2({ ...input, email, openId: `local:${randomUUID()}`, passwordHash: hashPassword(input.password) });
      const verificationDelivery = await sendAccountLink({ email, userId: user.id, purpose: "verify_email", origin: input.origin });
      return { id: user.id, verificationDelivery };
    }),
    signIn: publicProcedure.input(z2.object({ email: z2.string().trim().email().max(320), password: z2.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
      const credential = await findLocalCredentialByEmail2(input.email.toLowerCase());
      if (!credential || !verifyPassword(input.password, credential.passwordHash)) throw new TRPCError3({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
      if (!credential.emailVerifiedAt) throw new TRPCError3({ code: "FORBIDDEN", message: "Verify your email before signing in." });
      await touchUserSignIn2(credential.userId);
      await issueLocalSession(ctx.req, ctx.res, credential.userId);
      return { id: credential.userId, role: credential.role };
    }),
    adminSignIn: publicProcedure.input(z2.object({ loginId: z2.string().trim().min(1).max(255), password: z2.string().min(1).max(255) })).mutation(async ({ ctx, input }) => {
      if (!verifyConfiguredAdminCredentials(input.loginId, input.password)) throw new TRPCError3({ code: "UNAUTHORIZED", message: "Administrator ID or password is incorrect." });
      const admin = await ensureConfiguredAdmin2(getConfiguredAdminOpenId(input.loginId));
      await issueLocalSession(ctx.req, ctx.res, admin.id);
      return { id: admin.id, role: "admin" };
    }),
    requestVerification: publicProcedure.input(z2.object({ email: z2.string().trim().email().max(320), origin: z2.string().url() })).mutation(async ({ input }) => {
      const account = await findLocalAccountByEmail2(input.email.toLowerCase());
      if (!account || !account.email || account.emailVerifiedAt) return { accepted: true, delivery: { mode: "sent" } };
      return { accepted: true, delivery: await sendAccountLink({ email: account.email, userId: account.userId, purpose: "verify_email", origin: input.origin }) };
    }),
    verifyEmail: publicProcedure.input(z2.object({ token: z2.string().min(32).max(256) })).mutation(async ({ input }) => {
      const token = await consumeAccountToken2(hashAccountToken(input.token), "verify_email");
      if (!token) throw new TRPCError3({ code: "BAD_REQUEST", message: "This verification link is invalid, expired, or has already been used." });
      await markEmailVerified2(token.userId);
      return { verified: true };
    }),
    requestPasswordReset: publicProcedure.input(z2.object({ email: z2.string().trim().email().max(320), origin: z2.string().url() })).mutation(async ({ input }) => {
      const account = await findLocalAccountByEmail2(input.email.toLowerCase());
      if (!account || !account.email) return { accepted: true, delivery: { mode: "sent" } };
      return { accepted: true, delivery: await sendAccountLink({ email: account.email, userId: account.userId, purpose: "reset_password", origin: input.origin }) };
    }),
    resetPassword: publicProcedure.input(z2.object({ token: z2.string().min(32).max(256), password: z2.string().min(10).max(128) })).mutation(async ({ ctx, input }) => {
      const token = await consumeAccountToken2(hashAccountToken(input.token), "reset_password");
      if (!token) throw new TRPCError3({ code: "BAD_REQUEST", message: "This reset link is invalid, expired, or has already been used." });
      await replaceLocalPassword2(token.userId, hashPassword(input.password));
      await issueLocalSession(ctx.req, ctx.res, token.userId);
      return { reset: true };
    })
  }),
  profile: router({
    get: protectedProcedure.query(({ ctx }) => getStudentProfile2(ctx.user.id)),
    save: protectedProcedure.input(
      z2.object({
        fullName: z2.string().trim().min(2).max(255),
        collegeName: z2.string().trim().max(255).nullable().optional(),
        rollNumber: z2.string().trim().max(128).nullable().optional()
      })
    ).mutation(({ ctx, input }) => upsertStudentProfile2({ userId: ctx.user.id, ...input }))
  }),
  student: router({
    overview: protectedProcedure.query(({ ctx }) => getStudentOverview2(ctx.user.id)),
    startAttempt: protectedProcedure.input(z2.object({ examId: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const attempt = await startExamAttempt2(ctx.user.id, input.examId);
      return { attemptId: attempt.id };
    }),
    getAttempt: protectedProcedure.input(z2.object({ attemptId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
      const attempt = await getStudentAttempt2(ctx.user.id, input.attemptId);
      if (!attempt) throw new TRPCError3({ code: "NOT_FOUND", message: "Exam attempt was not found." });
      return attempt;
    }),
    saveAnswer: protectedProcedure.input(
      z2.object({
        attemptId: z2.number().int().positive(),
        questionId: z2.number().int().positive(),
        selectedOption: answerOptionSchema.nullable(),
        markedForReview: z2.boolean()
      })
    ).mutation(({ ctx, input }) => saveAttemptAnswer2(ctx.user.id, input)),
    submitAttempt: protectedProcedure.input(
      z2.object({
        attemptId: z2.number().int().positive(),
        reason: z2.enum(["manual", "timeout", "integrity_threshold"]).default("manual")
      })
    ).mutation(({ ctx, input }) => submitExamAttempt2(ctx.user.id, input.attemptId, input.reason))
  }),
  proctoring: router({
    logEvent: protectedProcedure.input(
      z2.object({
        attemptId: z2.number().int().positive(),
        eventType: z2.enum(EVENT_TYPES),
        durationMs: z2.number().int().min(0).max(6e5).default(0),
        metadata: z2.record(z2.string(), z2.unknown()).optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const outcome = await recordProctoringEvent2(ctx.user.id, input);
      const config = normalizeProctoringConfig(outcome.proctoringConfig);
      const escalation = getIntegrityEscalation(outcome.eventCount, config);
      const immediateSubmission = requiresImmediateIntegritySubmission(input.eventType) && (input.eventType === "tab_hidden" && config.immediateSubmitOnFocusLoss || input.eventType === "audio_activity" && config.audioMonitoringEnabled && config.immediateSubmitOnAudioActivity);
      const shouldAutoSubmit = immediateSubmission || escalation.shouldAutoSubmit;
      if (shouldAutoSubmit) {
        const title = immediateSubmission ? input.eventType === "audio_activity" ? "Assessment submitted after audio activity" : "Assessment submitted after focus loss" : "High-risk integrity threshold";
        const body = immediateSubmission ? input.eventType === "audio_activity" ? `Attempt #${input.attemptId} was automatically submitted after configured sustained audio activity. This signal does not identify a speaker; review the recorded context before taking any further action.` : `Attempt #${input.attemptId} was automatically submitted after the browser lost focus or was minimized. Review the recorded context before taking any further action.` : `Attempt #${input.attemptId} reached its configured automatic-submission threshold.`;
        await createAdminNotification2({ type: "high_risk_integrity", title, body, destination: `/admin/attempt/${input.attemptId}`, relatedAttemptId: input.attemptId });
        notifyAdministrators();
      }
      if (shouldAutoSubmit) {
        const result = await submitExamAttempt2(ctx.user.id, input.attemptId, "integrity_threshold");
        return { ...escalation, shouldWarn: true, shouldAutoSubmit: true, submitted: true, result };
      }
      return { ...escalation, submitted: false };
    })
  }),
  support: router({
    list: protectedProcedure.input(z2.object({ attemptId: z2.number().int().positive() })).query(({ ctx, input }) => getSupportMessages2(input.attemptId, ctx.user.id, ctx.user.role === "admin")),
    send: protectedProcedure.input(z2.object({ attemptId: z2.number().int().positive(), message: z2.string().trim().min(1).max(1500) })).mutation(async ({ ctx, input }) => {
      const result = await sendSupportMessage2({ ...input, senderUserId: ctx.user.id, senderRole: ctx.user.role === "admin" ? "admin" : "student" });
      notifySupportConversation(input.attemptId);
      if (ctx.user.role !== "admin") {
        await createAdminNotification2({ type: "support_message", title: "New technical support request", body: `A student sent a technical support message for attempt #${input.attemptId}.`, destination: "/admin/support", relatedAttemptId: input.attemptId });
        notifyAdministrators();
      }
      return result;
    }),
    inbox: adminProcedure.query(() => listSupportInbox2())
  }),
  notifications: router({
    list: adminProcedure.query(() => listAdminNotifications2()),
    markRead: adminProcedure.input(z2.object({ notificationId: z2.number().int().positive() })).mutation(({ input }) => markAdminNotificationRead2(input.notificationId))
  }),
  admin: router({
    listExams: adminProcedure.query(() => listAdminExams2()),
    createExam: adminProcedure.input(examInputSchema).mutation(({ ctx, input }) => createExam2(ctx.user.id, input)),
    getExam: adminProcedure.input(z2.object({ examId: z2.number().int().positive() })).query(async ({ input }) => {
      const exam = await getAdminExam2(input.examId);
      if (!exam) throw new TRPCError3({ code: "NOT_FOUND", message: "Assessment was not found." });
      return exam;
    }),
    updateExam: adminProcedure.input(z2.object({ examId: z2.number().int().positive(), updates: examInputSchema })).mutation(({ ctx, input }) => updateExam2(ctx.user.id, input.examId, input.updates)),
    getAttemptReview: adminProcedure.input(z2.object({ attemptId: z2.number().int().positive() })).query(async ({ input }) => {
      const review = await getAttemptReview2(input.attemptId);
      if (!review) throw new TRPCError3({ code: "NOT_FOUND", message: "Exam attempt was not found." });
      return review;
    }),
    reopenAttempt: adminProcedure.input(z2.object({ attemptId: z2.number().int().positive(), basis: z2.enum(["technical_failure", "approved_accommodation"]), note: z2.string().trim().min(5).max(1e3) })).mutation(({ ctx, input }) => reopenExamAttempt2(ctx.user.id, input.attemptId, input.basis, input.note)),
    listUsers: adminProcedure.query(() => listManagedUsers2()),
    updateUser: adminProcedure.input(z2.object({ userId: z2.number().int().positive(), fullName: z2.string().trim().min(2).max(255), collegeName: z2.string().trim().max(255).nullable().optional(), rollNumber: z2.string().trim().max(128).nullable().optional(), role: z2.enum(["user", "admin"]) })).mutation(({ ctx, input }) => updateManagedUser2(ctx.user.id, input)),
    resultsExport: adminProcedure.query(() => getResultsExport2())
  })
});

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      clearLocalSession(ctx.req, ctx.res);
      return { success: true };
    })
  }),
  proctorx: proctorxRouter
});

// server/vercelApp.ts
function createVercelApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}

// server/vercelEntry.ts
var vercelEntry_default = createVercelApp();
export {
  vercelEntry_default as default
};
