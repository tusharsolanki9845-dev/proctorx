import {
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Core identity table managed by the project authentication flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  emailVerifiedAt: timestamp("emailVerifiedAt"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, table => [uniqueIndex("users_email_unique").on(table.email)]);

export const studentProfiles = mysqlTable(
  "studentProfiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fullName: varchar("fullName", { length: 255 }).notNull(),
    collegeName: varchar("collegeName", { length: 255 }),
    rollNumber: varchar("rollNumber", { length: 128 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("studentProfiles_userId_unique").on(table.userId)]
);

export const localCredentials = mysqlTable(
  "localCredentials",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("localCredentials_userId_unique").on(table.userId)]
);

export const accountTokens = mysqlTable(
  "accountTokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
    purpose: mysqlEnum("purpose", ["verify_email", "reset_password"]).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    consumedAt: timestamp("consumedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("accountTokens_hash_unique").on(table.tokenHash), index("accountTokens_user_purpose_idx").on(table.userId, table.purpose, table.expiresAt)]
);

export const exams = mysqlTable(
  "exams",
  {
    id: int("id").autoincrement().primaryKey(),
    createdByUserId: int("createdByUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    durationSeconds: int("durationSeconds").notNull(),
    startsAt: timestamp("startsAt"),
    endsAt: timestamp("endsAt"),
    status: mysqlEnum("status", ["draft", "scheduled", "live", "closed", "archived"])
      .default("draft")
      .notNull(),
    maxAttempts: int("maxAttempts").default(1).notNull(),
    shuffleQuestions: int("shuffleQuestions").default(0).notNull(),
    releaseResultsImmediately: int("releaseResultsImmediately").default(1).notNull(),
    proctoringConfig: json("proctoringConfig"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("exams_status_idx").on(table.status), index("exams_schedule_idx").on(table.startsAt, table.endsAt)]
);

export const questions = mysqlTable(
  "questions",
  {
    id: int("id").autoincrement().primaryKey(),
    examId: int("examId")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    optionA: text("optionA").notNull(),
    optionB: text("optionB").notNull(),
    optionC: text("optionC").notNull(),
    optionD: text("optionD").notNull(),
    correctOption: mysqlEnum("correctOption", ["A", "B", "C", "D"]).notNull(),
    points: int("points").default(1).notNull(),
    orderIndex: int("orderIndex").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("questions_exam_order_idx").on(table.examId, table.orderIndex)]
);

export const examAttempts = mysqlTable(
  "examAttempts",
  {
    id: int("id").autoincrement().primaryKey(),
    examId: int("examId")
      .notNull()
      .references(() => exams.id, { onDelete: "restrict" }),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["in_progress", "submitted", "reviewed", "invalidated"])
      .default("in_progress")
      .notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    submittedAt: timestamp("submittedAt"),
    submissionReason: mysqlEnum("submissionReason", ["manual", "timeout", "integrity_threshold", "admin_action"]),
    score: int("score"),
    maxScore: int("maxScore"),
    integrityRiskScore: int("integrityRiskScore").default(0).notNull(),
    lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  },
  table => [index("examAttempts_exam_user_idx").on(table.examId, table.userId), index("examAttempts_status_idx").on(table.status)]
);

export const attemptAnswers = mysqlTable(
  "attemptAnswers",
  {
    id: int("id").autoincrement().primaryKey(),
    attemptId: int("attemptId")
      .notNull()
      .references(() => examAttempts.id, { onDelete: "cascade" }),
    questionId: int("questionId")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    selectedOption: mysqlEnum("selectedOption", ["A", "B", "C", "D"]),
    markedForReview: int("markedForReview").default(0).notNull(),
    isCorrect: int("isCorrect"),
    answeredAt: timestamp("answeredAt"),
  },
  table => [uniqueIndex("attemptAnswers_attempt_question_unique").on(table.attemptId, table.questionId)]
);

export const proctoringEvents = mysqlTable(
  "proctoringEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    attemptId: int("attemptId")
      .notNull()
      .references(() => examAttempts.id, { onDelete: "cascade" }),
    eventType: mysqlEnum("eventType", [
      "camera_interrupted",
      "face_absent",
      "multiple_faces",
      "fullscreen_exit",
      "tab_hidden",
      "device_check_failed",
      "audio_activity",
    ]).notNull(),
    severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("warning").notNull(),
    detectedAt: timestamp("detectedAt").defaultNow().notNull(),
    durationMs: int("durationMs").default(0).notNull(),
    metadata: json("metadata"),
    resolvedAt: timestamp("resolvedAt"),
  },
  table => [index("proctoringEvents_attempt_time_idx").on(table.attemptId, table.detectedAt)]
);

export const supportMessages = mysqlTable(
  "supportMessages",
  {
    id: int("id").autoincrement().primaryKey(),
    attemptId: int("attemptId")
      .notNull()
      .references(() => examAttempts.id, { onDelete: "cascade" }),
    senderUserId: int("senderUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    senderRole: mysqlEnum("senderRole", ["student", "admin"]).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    readAt: timestamp("readAt"),
  },
  table => [index("supportMessages_attempt_time_idx").on(table.attemptId, table.createdAt)]
);

export const adminNotifications = mysqlTable(
  "adminNotifications",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", ["support_message", "high_risk_integrity"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    destination: varchar("destination", { length: 512 }).notNull(),
    relatedAttemptId: int("relatedAttemptId").references(() => examAttempts.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    readAt: timestamp("readAt"),
  },
  table => [index("adminNotifications_read_time_idx").on(table.readAt, table.createdAt)]
);

export const examAuditLogs = mysqlTable(
  "examAuditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entityType", { length: 64 }).notNull(),
    entityId: int("entityId"),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("examAuditLogs_entity_idx").on(table.entityType, table.entityId), index("examAuditLogs_actor_idx").on(table.actorUserId)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Exam = typeof exams.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type ExamAttempt = typeof examAttempts.$inferSelect;
