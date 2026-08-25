CREATE TABLE `localCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `localCredentials_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `supportMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`senderUserId` int NOT NULL,
	`senderRole` enum('student','admin') NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`readAt` timestamp,
	CONSTRAINT `supportMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `localCredentials` ADD CONSTRAINT `localCredentials_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supportMessages` ADD CONSTRAINT `supportMessages_attemptId_examAttempts_id_fk` FOREIGN KEY (`attemptId`) REFERENCES `examAttempts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supportMessages` ADD CONSTRAINT `supportMessages_senderUserId_users_id_fk` FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `supportMessages_attempt_time_idx` ON `supportMessages` (`attemptId`,`createdAt`);