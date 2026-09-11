CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created` text NOT NULL,
	`total` integer NOT NULL,
	`method` text NOT NULL,
	`received` integer NOT NULL,
	`items` text NOT NULL,
	`cancelled` text,
	`reason` text
);
--> statement-breakpoint
CREATE INDEX `orders_owner_created` ON `orders` (`owner`,`created`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`category` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_owner` ON `products` (`owner`);