CREATE TABLE `department_process_events` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`process_id` text NOT NULL,
	`action` text NOT NULL,
	`from_stage` text,
	`to_stage` text,
	`actor_id` text NOT NULL,
	`actor_name` text,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`process_id`) REFERENCES `department_processes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_dept_proc_events` ON `department_process_events` (`process_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `department_processes` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`department_slug` text NOT NULL,
	`template_key` text NOT NULL,
	`title` text NOT NULL,
	`stage_key` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`owner_name` text,
	`requester_id` text NOT NULL,
	`requester_name` text,
	`due_date` text,
	`data` text DEFAULT '{}' NOT NULL,
	`outcome` text,
	`blocked_reason` text,
	`version` integer DEFAULT 1 NOT NULL,
	`stage_entered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`closed_at` text,
	CONSTRAINT "dept_status" CHECK("department_processes"."status" in ('active','blocked','done','cancelled')),
	CONSTRAINT "dept_priority" CHECK("department_processes"."priority" in ('low','normal','high','critical'))
);
--> statement-breakpoint
CREATE INDEX `idx_dept_proc_org` ON `department_processes` (`organization_id`,`department_slug`,`status`);