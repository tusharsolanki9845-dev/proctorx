import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import * as db from "./db";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getConfiguredAdminOpenId, hashPassword, verifyConfiguredAdminCredentials, verifyPassword } from "./localAuth";
import { issueLocalSession } from "./localSession";
import { notifySupportConversation } from "./supportRealtime";
import {
  DEFAULT_PROCTORING_CONFIG,
  EVENT_TYPES,
  getIntegrityEscalation,
  normalizeProctoringConfig,
  type AnswerOption,
} from "../shared/proctoring";

const answerOptionSchema = z.enum(["A", "B", "C", "D"]);

const proctoringConfigSchema = z.object({
  faceAbsentThresholdSeconds: z.number().int().min(1).max(120).default(DEFAULT_PROCTORING_CONFIG.faceAbsentThresholdSeconds),
  multipleFaceThresholdSeconds: z.number().int().min(1).max(120).default(DEFAULT_PROCTORING_CONFIG.multipleFaceThresholdSeconds),
  warningEventCount: z.number().int().min(1).max(50).default(DEFAULT_PROCTORING_CONFIG.warningEventCount),
  autoSubmitEventCount: z.number().int().min(2).max(100).default(DEFAULT_PROCTORING_CONFIG.autoSubmitEventCount),
});

const questionInputSchema = z.object({
  prompt: z.string().trim().min(4).max(3000),
  optionA: z.string().trim().min(1).max(1000),
  optionB: z.string().trim().min(1).max(1000),
  optionC: z.string().trim().min(1).max(1000),
  optionD: z.string().trim().min(1).max(1000),
  correctOption: answerOptionSchema,
  points: z.number().int().min(1).max(100).default(1),
});

const examInputSchema = z
  .object({
    title: z.string().trim().min(3).max(255),
    description: z.string().trim().max(5000).nullable().optional(),
    durationSeconds: z.number().int().min(60).max(43200),
    startsAt: z.date().nullable().optional(),
    endsAt: z.date().nullable().optional(),
    status: z.enum(["draft", "scheduled", "live", "closed", "archived"]).default("draft"),
    maxAttempts: z.number().int().min(1).max(10).default(1),
    shuffleQuestions: z.boolean().default(false),
    releaseResultsImmediately: z.boolean().default(true),
    proctoringConfig: proctoringConfigSchema.default(DEFAULT_PROCTORING_CONFIG),
    questions: z.array(questionInputSchema).min(1).max(100),
  })
  .refine(value => !value.startsAt || !value.endsAt || value.startsAt < value.endsAt, {
    message: "The end time must be later than the start time.",
    path: ["endsAt"],
  });

export const proctorxRouter = router({
  credentials: router({
    signUp: publicProcedure
      .input(z.object({ fullName: z.string().trim().min(2).max(255), email: z.string().trim().email().max(320), password: z.string().min(10).max(128), collegeName: z.string().trim().max(255).nullable().optional(), rollNumber: z.string().trim().max(128).nullable().optional() }))
      .mutation(async ({ ctx, input }) => {
        const email = input.email.toLowerCase();
        const user = await db.createLocalStudent({ ...input, email, openId: `local:${randomUUID()}`, passwordHash: hashPassword(input.password) });
        await issueLocalSession(ctx.req, ctx.res, user.id);
        return { id: user.id, role: "user" as const };
      }),
    signIn: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const credential = await db.findLocalCredentialByEmail(input.email.toLowerCase());
        if (!credential || !verifyPassword(input.password, credential.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
        await db.touchUserSignIn(credential.userId);
        await issueLocalSession(ctx.req, ctx.res, credential.userId);
        return { id: credential.userId, role: credential.role };
      }),
    adminSignIn: publicProcedure
      .input(z.object({ loginId: z.string().trim().min(1).max(255), password: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        if (!verifyConfiguredAdminCredentials(input.loginId, input.password)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Administrator ID or password is incorrect." });
        const admin = await db.ensureConfiguredAdmin(getConfiguredAdminOpenId(input.loginId));
        await issueLocalSession(ctx.req, ctx.res, admin.id);
        return { id: admin.id, role: "admin" as const };
      }),
  }),
  profile: router({
    get: protectedProcedure.query(({ ctx }) => db.getStudentProfile(ctx.user.id)),
    save: protectedProcedure
      .input(
        z.object({
          fullName: z.string().trim().min(2).max(255),
          collegeName: z.string().trim().max(255).nullable().optional(),
          rollNumber: z.string().trim().max(128).nullable().optional(),
        })
      )
      .mutation(({ ctx, input }) => db.upsertStudentProfile({ userId: ctx.user.id, ...input })),
  }),

  student: router({
    overview: protectedProcedure.query(({ ctx }) => db.getStudentOverview(ctx.user.id)),
    startAttempt: protectedProcedure
      .input(z.object({ examId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const attempt = await db.startExamAttempt(ctx.user.id, input.examId);
        return { attemptId: attempt.id };
      }),
    getAttempt: protectedProcedure
      .input(z.object({ attemptId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const attempt = await db.getStudentAttempt(ctx.user.id, input.attemptId);
        if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "Exam attempt was not found." });
        return attempt;
      }),
    saveAnswer: protectedProcedure
      .input(
        z.object({
          attemptId: z.number().int().positive(),
          questionId: z.number().int().positive(),
          selectedOption: answerOptionSchema.nullable(),
          markedForReview: z.boolean(),
        })
      )
      .mutation(({ ctx, input }) => db.saveAttemptAnswer(ctx.user.id, input)),
    submitAttempt: protectedProcedure
      .input(
        z.object({
          attemptId: z.number().int().positive(),
          reason: z.enum(["manual", "timeout", "integrity_threshold"]).default("manual"),
        })
      )
      .mutation(({ ctx, input }) => db.submitExamAttempt(ctx.user.id, input.attemptId, input.reason)),
  }),

  proctoring: router({
    logEvent: protectedProcedure
      .input(
        z.object({
          attemptId: z.number().int().positive(),
          eventType: z.enum(EVENT_TYPES),
          durationMs: z.number().int().min(0).max(600000).default(0),
          metadata: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const outcome = await db.recordProctoringEvent(ctx.user.id, input);
        const escalation = getIntegrityEscalation(outcome.eventCount, normalizeProctoringConfig(outcome.proctoringConfig));
        if (escalation.shouldAutoSubmit) {
          const result = await db.submitExamAttempt(ctx.user.id, input.attemptId, "integrity_threshold");
          return { ...escalation, submitted: true, result };
        }
        return { ...escalation, submitted: false };
      }),
  }),

  support: router({
    list: protectedProcedure
      .input(z.object({ attemptId: z.number().int().positive() }))
      .query(({ ctx, input }) => db.getSupportMessages(input.attemptId, ctx.user.id, ctx.user.role === "admin")),
    send: protectedProcedure
      .input(z.object({ attemptId: z.number().int().positive(), message: z.string().trim().min(1).max(1500) }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.sendSupportMessage({ ...input, senderUserId: ctx.user.id, senderRole: ctx.user.role === "admin" ? "admin" : "student" });
        notifySupportConversation(input.attemptId);
        return result;
      }),
    inbox: adminProcedure.query(() => db.listSupportInbox()),
  }),

  admin: router({
    listExams: adminProcedure.query(() => db.listAdminExams()),
    createExam: adminProcedure
      .input(examInputSchema)
      .mutation(({ ctx, input }) => db.createExam(ctx.user.id, input)),
    getExam: adminProcedure
      .input(z.object({ examId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const exam = await db.getAdminExam(input.examId);
        if (!exam) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment was not found." });
        return exam;
      }),
    updateExam: adminProcedure
      .input(z.object({ examId: z.number().int().positive(), updates: examInputSchema }))
      .mutation(({ ctx, input }) => db.updateExam(ctx.user.id, input.examId, input.updates)),
    getAttemptReview: adminProcedure
      .input(z.object({ attemptId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const review = await db.getAttemptReview(input.attemptId);
        if (!review) throw new TRPCError({ code: "NOT_FOUND", message: "Exam attempt was not found." });
        return review;
      }),
    listUsers: adminProcedure.query(() => db.listManagedUsers()),
    updateUser: adminProcedure
      .input(z.object({ userId: z.number().int().positive(), fullName: z.string().trim().min(2).max(255), collegeName: z.string().trim().max(255).nullable().optional(), rollNumber: z.string().trim().max(128).nullable().optional(), role: z.enum(["user", "admin"]) }))
      .mutation(({ ctx, input }) => db.updateManagedUser(ctx.user.id, input)),
    resultsExport: adminProcedure.query(() => db.getResultsExport()),
  }),
});

export type ProctorxRouter = typeof proctorxRouter;
