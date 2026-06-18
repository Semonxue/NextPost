CREATE TABLE `Account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`platformId` text NOT NULL,
	`name` text NOT NULL,
	`handle` text NOT NULL,
	`description` text,
	`deletedAt` text,
	`deletedBy` text,
	`deleteNote` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Account_deletedAt_idx` ON `Account` (`deletedAt`);--> statement-breakpoint
CREATE INDEX `Account_userId_idx` ON `Account` (`userId`);--> statement-breakpoint
CREATE TABLE `AiOperationLog` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`conversationId` text,
	`operation` text NOT NULL,
	`entityType` text NOT NULL,
	`entityId` text NOT NULL,
	`beforeState` text,
	`afterState` text,
	`aiModel` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `AiOperationLog_userId_idx` ON `AiOperationLog` (`userId`);--> statement-breakpoint
CREATE INDEX `AiOperationLog_entity_idx` ON `AiOperationLog` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `AiOperationLog_createdAt_idx` ON `AiOperationLog` (`createdAt`);--> statement-breakpoint
CREATE TABLE `Conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`title` text DEFAULT '新对话' NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ExternalApiKey` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`permissions` text DEFAULT 'read_report' NOT NULL,
	`lastUsedAt` text,
	`expiresAt` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ExternalApiKey_key_unique` ON `ExternalApiKey` (`key`);--> statement-breakpoint
CREATE INDEX `ExternalApiKey_userId_idx` ON `ExternalApiKey` (`userId`);--> statement-breakpoint
CREATE INDEX `ExternalApiKey_key_idx` ON `ExternalApiKey` (`key`);--> statement-breakpoint
CREATE TABLE `Media` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`thumbnailUrl` text,
	`filename` text NOT NULL,
	`size` integer NOT NULL,
	`mimeType` text NOT NULL,
	`uploadedAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversationId` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`toolCalls` text DEFAULT '[]' NOT NULL,
	`toolResults` text DEFAULT '[]' NOT NULL,
	`model` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `Platform` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Platform_name_unique` ON `Platform` (`name`);--> statement-breakpoint
CREATE TABLE `PlatformConfig` (
	`id` text PRIMARY KEY NOT NULL,
	`platformId` text NOT NULL,
	`maxContentLength` integer DEFAULT 280 NOT NULL,
	`maxImages` integer DEFAULT 4 NOT NULL,
	`maxVideos` integer DEFAULT 1 NOT NULL,
	`allowMixedMedia` integer DEFAULT true NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `PlatformConfig_platformId_unique` ON `PlatformConfig` (`platformId`);--> statement-breakpoint
CREATE TABLE `Post` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`content` text NOT NULL,
	`title` text,
	`mediaUrls` text DEFAULT '[]' NOT NULL,
	`mediaThumbnails` text DEFAULT '[]' NOT NULL,
	`scheduledTime` text,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`publishToken` text,
	`publishTokenExp` text,
	`publishedAt` text,
	`externalPostId` text,
	`externalPostUrl` text,
	`publishError` text,
	`publishAttempts` integer DEFAULT 0 NOT NULL,
	`deletedAt` text,
	`deletedBy` text,
	`deleteNote` text,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `Post_status_idx` ON `Post` (`status`);--> statement-breakpoint
CREATE INDEX `Post_scheduledTime_idx` ON `Post` (`scheduledTime`);--> statement-breakpoint
CREATE INDEX `Post_deletedAt_idx` ON `Post` (`deletedAt`);--> statement-breakpoint
CREATE INDEX `Post_userId_idx` ON `Post` (`userId`);--> statement-breakpoint
CREATE TABLE `User` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`email` text,
	`aiProvider` text DEFAULT 'openai' NOT NULL,
	`aiApiKey` text,
	`aiModel` text DEFAULT 'gpt-4' NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `User_username_unique` ON `User` (`username`);