-- Clear Bid D1 initial schema
CREATE TABLE IF NOT EXISTS `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `display_name` text,
  `timezone` text DEFAULT 'Asia/Tokyo',
  `access_subject` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `user_documents` (
  `user_id` text NOT NULL,
  `key` text NOT NULL,
  `json` text NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`user_id`, `key`)
);

CREATE TABLE IF NOT EXISTS `profiles` (
  `user_id` text PRIMARY KEY NOT NULL,
  `bio` text,
  `weekly_minutes` integer DEFAULT 600 NOT NULL,
  `min_hourly_yen` integer DEFAULT 2000 NOT NULL,
  `min_contract_yen` integer DEFAULT 30000,
  `available_times` text,
  `mtg_limit` text,
  `capacity` text,
  `ng_conditions_json` text,
  `fee_rate_default` integer DEFAULT 20,
  `updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `profile_skills` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `level` text NOT NULL,
  `years` real,
  `last_used_at` text,
  `usable_in_proposal` integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS `profile_achievements` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `title` text NOT NULL,
  `problem` text,
  `action` text,
  `result` text,
  `metrics` text,
  `tech_json` text,
  `visibility` text,
  `usable_in_proposal` integer DEFAULT 1
);

CREATE TABLE IF NOT EXISTS `opportunities` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `title` text NOT NULL,
  `platform` text NOT NULL,
  `source_job_id` text,
  `url` text,
  `body` text NOT NULL,
  `budget_type` text,
  `budget_min_yen` integer,
  `budget_max_yen` integer,
  `current_status` text NOT NULL,
  `deleted_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `diagnosis_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `opportunity_id` text NOT NULL,
  `version` integer NOT NULL,
  `recommendation` text,
  `recommendation_reason` text,
  `user_decision` text,
  `created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `safety_findings` (
  `id` text PRIMARY KEY NOT NULL,
  `diagnosis_version_id` text NOT NULL,
  `rule_id` text NOT NULL,
  `rule_version` integer NOT NULL,
  `classification` text NOT NULL,
  `source` text NOT NULL,
  `quote` text,
  `reason` text NOT NULL,
  `confidence` text,
  `status` text NOT NULL,
  `user_note` text
);

CREATE TABLE IF NOT EXISTS `effort_estimates` (
  `id` text PRIMARY KEY NOT NULL,
  `diagnosis_version_id` text NOT NULL,
  `min_minutes` integer NOT NULL,
  `likely_minutes` integer NOT NULL,
  `max_minutes` integer NOT NULL,
  `buffer_rate` real NOT NULL,
  `buffer_reason` text
);

CREATE TABLE IF NOT EXISTS `proposals` (
  `id` text PRIMARY KEY NOT NULL,
  `diagnosis_version_id` text NOT NULL,
  `strategy` text NOT NULL,
  `strategy_reason` text,
  `body` text NOT NULL,
  `used_achievement_ids_json` text,
  `prompt_version` text,
  `created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `pipeline_events` (
  `id` text PRIMARY KEY NOT NULL,
  `opportunity_id` text NOT NULL,
  `from_status` text,
  `to_status` text NOT NULL,
  `reason_code` text,
  `note` text,
  `created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `ai_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `opportunity_id` text,
  `diagnosis_version_id` text,
  `operation` text NOT NULL,
  `provider` text NOT NULL,
  `model_alias` text,
  `model_name` text,
  `prompt_version` text,
  `schema_version` text,
  `input_tokens` integer,
  `output_tokens` integer,
  `cost_microusd` integer,
  `duration_ms` integer,
  `status` text NOT NULL,
  `error_code` text,
  `idempotency_key` text NOT NULL,
  `created_at` text NOT NULL
);

CREATE INDEX IF NOT EXISTS `idx_opportunities_user_status` ON `opportunities` (`user_id`, `current_status`);
CREATE INDEX IF NOT EXISTS `idx_user_documents_user` ON `user_documents` (`user_id`);
