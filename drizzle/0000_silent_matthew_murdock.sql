CREATE TABLE `referral_code_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`codeHash` varchar(66) NOT NULL,
	`referrerAddress` varchar(42) NOT NULL,
	`status` enum('pending','active','disabled','failed') NOT NULL DEFAULT 'pending',
	`txHash` varchar(66),
	`configuredBy` varchar(42) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `referral_code_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_code_mappings_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `siwe_nonces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nonce` varchar(128) NOT NULL,
	`walletAddress` varchar(42) NOT NULL,
	`domain` varchar(255) NOT NULL,
	`uri` varchar(512) NOT NULL,
	`chainId` int NOT NULL,
	`issuedAt` timestamp NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `siwe_nonces_id` PRIMARY KEY(`id`),
	CONSTRAINT `siwe_nonces_nonce_unique` UNIQUE(`nonce`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
