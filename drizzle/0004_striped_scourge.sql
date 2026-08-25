CREATE TABLE `accountTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`purpose` enum('verify_email','reset_password') NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accountTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `accountTokens_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `adminNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('support_message','high_risk_integrity') NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`destination` varchar(512) NOT NULL,
	`relatedAttemptId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `adminNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `accountTokens` ADD CONSTRAINT `accountTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `adminNotifications` ADD CONSTRAINT `adminNotifications_relatedAttemptId_examAttempts_id_fk` FOREIGN KEY (`relatedAttemptId`) REFERENCES `examAttempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `accountTokens_user_purpose_idx` ON `accountTokens` (`userId`,`purpose`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `adminNotifications_read_time_idx` ON `adminNotifications` (`readAt`,`createdAt`);