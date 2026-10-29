-- ---------------------------------------------------------------------------
-- Seasons as records, and the operating parameters that were hardcoded.
--
-- WHY SEASONS ARE A TABLE, NOT A DATE
-- A single season_start_date cannot answer "what did we do last year", cannot
-- be prepared in advance, and makes rolling over to a new season a destructive
-- edit of the only copy. A mill runs one season after another; the app should
-- hold them all and know which one is live.
--
-- WHY THE PARAMETERS MOVE OUT OF THE CODE
-- Every value below was a literal in calculationService or bandService. Each
-- default here is exactly the value that was compiled in, so behaviour is
-- unchanged until somebody deliberately changes one. The point is that a mill
-- that orders on a different cadence, or renames a centre, can be configured
-- rather than needing a developer.
-- ---------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS add_col_if_missing;

DELIMITER //
CREATE PROCEDURE add_col_if_missing(
  IN tbl VARCHAR(64), IN col VARCHAR(64), IN def VARCHAR(512)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
  END IF;
END //
DELIMITER ;

-- ── seasons ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `seasons` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `org_id` INT NOT NULL,
  -- How the mill says it: "2026-27".
  `name` VARCHAR(64) NOT NULL,
  `start_date` DATE NOT NULL,
  `total_days` INT NOT NULL DEFAULT 180,
  `crushing_capacity` DECIMAL(16,2) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 0,
  -- Exactly one active season per organisation. MySQL has no partial unique
  -- index, but duplicate NULLs do not collide in a unique key — so this column
  -- holds 1 when active and NULL otherwise, and the database enforces the rule
  -- rather than trusting every code path to remember it.
  `active_flag` TINYINT(1)
      GENERATED ALWAYS AS (IF(`is_active` = 1, 1, NULL)) STORED,
  `notes` VARCHAR(500) DEFAULT NULL,
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_season_name` (`org_id`, `name`),
  UNIQUE KEY `uq_one_active_season` (`org_id`, `active_flag`),
  KEY `idx_season_org_start` (`org_id`, `start_date`),
  CONSTRAINT `fk_seasons_org` FOREIGN KEY (`org_id`)
    REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Carry the existing single date across so nothing is lost. Named from the
-- start year, which is how a crushing season spanning the new year is written.
INSERT INTO `seasons` (org_id, name, start_date, total_days, crushing_capacity, is_active)
SELECT s.org_id,
       CONCAT(YEAR(s.season_start_date), '-', RIGHT(YEAR(s.season_start_date) + 1, 2)),
       s.season_start_date,
       COALESCE(s.season_total_days, 180),
       s.seasonal_crushing_capacity,
       1
  FROM org_settings s
 WHERE s.season_start_date IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM seasons x WHERE x.org_id = s.org_id);

-- ── operating parameters ────────────────────────────────────────────────────
-- Days between placing an indent and the delivery it is raised for. The whole
-- cadence of the app. It was the literal 3 in sixteen places.
CALL add_col_if_missing('org_settings', 'delivery_lag_days',
  'INT NOT NULL DEFAULT 3');

-- From this week of the season, recommendations follow the mill's own latest
-- placement instead of the model (wind-down / closure planning).
CALL add_col_if_missing('org_settings', 'late_season_week',
  'INT NOT NULL DEFAULT 14');

-- Window of recent arrivals used to split the requirement between centres.
CALL add_col_if_missing('org_settings', 'throughput_window_days',
  'INT NOT NULL DEFAULT 14');

-- Below this recent D-weight, fall back to the season average: a centre with
-- almost no recent deliveries would otherwise read as near-zero delivery rate.
CALL add_col_if_missing('org_settings', 'dweight_fallback_threshold',
  'DECIMAL(5,3) NOT NULL DEFAULT 0.100');

-- Season shape, used for the reference bands only.
CALL add_col_if_missing('org_settings', 'phase_normal_max_week',
  'INT NOT NULL DEFAULT 12');
CALL add_col_if_missing('org_settings', 'phase_presurge_max_week',
  'INT NOT NULL DEFAULT 15');

-- How a gate centre is recognised. It was name.includes("GATE"), so renaming a
-- centre silently broke gate allocation.
CALL add_col_if_missing('org_settings', 'gate_match_pattern',
  'VARCHAR(64) NOT NULL DEFAULT ''GATE''');

-- Daily operating defaults, pre-filled on the calculator.
CALL add_col_if_missing('org_settings', 'default_daily_requirement',
  'DECIMAL(14,2) NOT NULL DEFAULT 100000');
CALL add_col_if_missing('org_settings', 'standard_stock_centre',
  'DECIMAL(14,2) NOT NULL DEFAULT 6000');
CALL add_col_if_missing('org_settings', 'standard_stock_gate',
  'DECIMAL(14,2) NOT NULL DEFAULT 9000');
CALL add_col_if_missing('org_settings', 'plant_capacity',
  'DECIMAL(10,2) NOT NULL DEFAULT 80');

DROP PROCEDURE add_col_if_missing;
