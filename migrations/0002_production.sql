-- Production features: server-side search, moderation, account bans, email change and admin audit log.
ALTER TABLE `users` ADD COLUMN `banned` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `ban_reason` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `last_login` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `search` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `city_key` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `updated` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `listings` ADD COLUMN `moderation_note` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `email_tokens` ADD COLUMN `data` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `resolution` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `reports` ADD COLUMN `resolved` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `admin_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`admin` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_log_created` ON `admin_log` (`created`);
--> statement-breakpoint
CREATE INDEX `listing_browse` ON `listings` (`status`,`country`,`buy`,`category`,`created`);
--> statement-breakpoint
CREATE INDEX `listing_owner` ON `listings` (`owner`,`status`,`created`);
--> statement-breakpoint
CREATE INDEX `listing_boost` ON `listings` (`status`,`boost_until`);
--> statement-breakpoint
CREATE INDEX `listing_city` ON `listings` (`status`,`city_key`);
--> statement-breakpoint
CREATE INDEX `report_status` ON `reports` (`status`,`created`);
--> statement-breakpoint
CREATE INDEX `report_listing` ON `reports` (`listing_id`,`status`);
--> statement-breakpoint
CREATE INDEX `conversation_buyer` ON `conversations` (`buyer`,`updated`);
--> statement-breakpoint
CREATE INDEX `conversation_seller` ON `conversations` (`seller`,`updated`);
--> statement-breakpoint
CREATE INDEX `message_unread` ON `messages` (`conversation_id`,`read`,`sender`);
--> statement-breakpoint
CREATE INDEX `favorite_listing` ON `favorites` (`listing_id`);
--> statement-breakpoint
CREATE INDEX `session_user` ON `sessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX `session_expires` ON `sessions` (`expires`);
--> statement-breakpoint
CREATE INDEX `token_user` ON `email_tokens` (`user_id`,`kind`);
--> statement-breakpoint
CREATE INDEX `view_listing` ON `listing_views` (`listing_id`);
--> statement-breakpoint
CREATE INDEX `rate_limit_expires` ON `rate_limits` (`expires`);
--> statement-breakpoint
CREATE INDEX `upload_owner` ON `uploads` (`owner`,`listing_id`,`created`);
--> statement-breakpoint
CREATE INDEX `user_created` ON `users` (`created`);
