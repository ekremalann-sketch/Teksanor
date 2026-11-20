-- Firma iş tanımları: firmanın kendi birimleri ve süreç türleri. Hazır katalog değişmez; yalnız yeni tablolar.
CREATE TABLE IF NOT EXISTS `organization_departments` (
	`organization_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`short` text NOT NULL,
	`mission` text DEFAULT '' NOT NULL,
	`owners` text DEFAULT '[]' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`organization_id`, `slug`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `organization_workflow_templates` (
	`organization_id` text NOT NULL,
	`department_slug` text NOT NULL,
	`template_key` text NOT NULL,
	`definition` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`organization_id`, `department_slug`, `template_key`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_org_wf_templates_org` ON `organization_workflow_templates` (`organization_id`, `active`);
