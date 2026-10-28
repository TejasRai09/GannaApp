-- ─────────────────────────────────────────────────────────────────────────────
-- Version 2, item 1: per-centre, per-day storage for the feedback loop.
--
-- v1 stored each run as one JSON blob in calculation_runs, so a question like
-- "show me every day GATE variance exceeded 20%" could not be answered without
-- parsing every blob in the browser. This table holds one row per centre per
-- delivery day carrying all four numbers, so variance is a plain SQL query.
--
-- Safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS `indent_ledger` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `org_id`             INT NOT NULL,
  `delivery_date`      DATE NOT NULL,
  `centre_id`          VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `centre_name`        VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_gate`            TINYINT(1) NOT NULL DEFAULT 0,

  -- (1) what the app said
  `app_indent`         DECIMAL(14,2) DEFAULT NULL,
  `excel_indent`       DECIMAL(14,2) DEFAULT NULL,

  -- (2) what the plant team said
  `plant_indent`       DECIMAL(14,2) DEFAULT NULL,
  `reason_code`        VARCHAR(48) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reason_note`        VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `plant_user_id`      INT DEFAULT NULL,
  -- anchoring guard: was the app's number on screen when they entered theirs?
  `saw_recommendation` TINYINT(1) DEFAULT NULL,
  `plant_entered_at`   TIMESTAMP NULL DEFAULT NULL,

  -- (3) and (4) what actually happened
  `actual_indent`      DECIMAL(14,2) DEFAULT NULL,
  `actual_arrival`     DECIMAL(14,2) DEFAULT NULL,
  `outcome_source`     ENUM('manual','import') COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  -- context kept alongside, so analysis never has to re-run the engine
  `requirement`        DECIMAL(14,2) DEFAULT NULL,
  `forecast_t3`        DECIMAL(14,2) DEFAULT NULL,
  `d1_weight`          DECIMAL(10,6) DEFAULT NULL,
  `ml_maturity`        DECIMAL(10,6) DEFAULT NULL,
  `week_of_season`     INT DEFAULT NULL,
  `run_id`             INT DEFAULT NULL,

  `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  -- one row per centre per delivery day: re-running the calculation updates,
  -- it does not duplicate
  UNIQUE KEY `uq_org_date_centre` (`org_id`,`delivery_date`,`centre_id`),
  KEY `idx_org_date` (`org_id`,`delivery_date`),
  KEY `idx_org_centre` (`org_id`,`centre_id`),
  KEY `idx_reason` (`org_id`,`reason_code`),
  CONSTRAINT `fk_ledger_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
