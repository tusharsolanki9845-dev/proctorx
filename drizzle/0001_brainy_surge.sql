CREATE TABLE `attemptAnswers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`questionId` int NOT NULL,
	`selectedOption` enum('A','B','C','D'),
	`markedForReview` int NOT NULL DEFAULT 0,
	`isCorrect` int,
	`answeredAt` timestamp,
	CONSTRAINT `attemptAnswers_id` PRIMARY KEY(`id`),
	CONSTRAINT `attemptAnswers_attempt_question_unique` UNIQUE(`attemptId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `examAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`examId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('in_progress','submitted','reviewed','invalidated') NOT NULL DEFAULT 'in_progress',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`submittedAt` timestamp,
	`submissionReason` enum('manual','timeout','integrity_threshold','admin_action'),
	`score` int,
	`maxScore` int,
	`integrityRiskScore` int NOT NULL DEFAULT 0,
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `examAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `examAuditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int NOT NULL,
	`action` varchar(128) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `examAuditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdByUserId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`durationSeconds` int NOT NULL,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`status` enum('draft','scheduled','live','closed','archived') NOT NULL DEFAULT 'draft',
	`maxAttempts` int NOT NULL DEFAULT 1,
	`shuffleQuestions` int NOT NULL DEFAULT 0,
	`releaseResultsImmediately` int NOT NULL DEFAULT 1,
	`proctoringConfig` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `exams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proctoringEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`eventType` enum('camera_interrupted','face_absent','multiple_faces','fullscreen_exit','tab_hidden','device_check_failed') NOT NULL,
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`durationMs` int NOT NULL DEFAULT 0,
	`metadata` json,
	`resolvedAt` timestamp,
	CONSTRAINT `proctoringEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`examId` int NOT NULL,
	`prompt` text NOT NULL,
	`optionA` text NOT NULL,
	`optionB` text NOT NULL,
	`optionC` text NOT NULL,
	`optionD` text NOT NULL,
	`correctOption` enum('A','B','C','D') NOT NULL,
	`points` int NOT NULL DEFAULT 1,
	`orderIndex` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `studentProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fullName` varchar(255) NOT NULL,
	`collegeName` varchar(255),
	`rollNumber` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `studentProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `studentProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `attemptAnswers` ADD CONSTRAINT `attemptAnswers_attemptId_examAttempts_id_fk` FOREIGN KEY (`attemptId`) REFERENCES `examAttempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attemptAnswers` ADD CONSTRAINT `attemptAnswers_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `examAttempts` ADD CONSTRAINT `examAttempts_examId_exams_id_fk` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `examAttempts` ADD CONSTRAINT `examAttempts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `examAuditLogs` ADD CONSTRAINT `examAuditLogs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exams` ADD CONSTRAINT `exams_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proctoringEvents` ADD CONSTRAINT `proctoringEvents_attemptId_examAttempts_id_fk` FOREIGN KEY (`attemptId`) REFERENCES `examAttempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_examId_exams_id_fk` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `studentProfiles` ADD CONSTRAINT `studentProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `examAttempts_exam_user_idx` ON `examAttempts` (`examId`,`userId`);--> statement-breakpoint
CREATE INDEX `examAttempts_status_idx` ON `examAttempts` (`status`);--> statement-breakpoint
CREATE INDEX `examAuditLogs_entity_idx` ON `examAuditLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `examAuditLogs_actor_idx` ON `examAuditLogs` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `exams_status_idx` ON `exams` (`status`);--> statement-breakpoint
CREATE INDEX `exams_schedule_idx` ON `exams` (`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `proctoringEvents_attempt_time_idx` ON `proctoringEvents` (`attemptId`,`detectedAt`);--> statement-breakpoint
CREATE INDEX `questions_exam_order_idx` ON `questions` (`examId`,`orderIndex`);