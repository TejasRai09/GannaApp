-- ---------------------------------------------------------------------------
-- Three roles, Microsoft (Entra ID) sign-in, persisted org settings, audit log.
--
-- ROLES
--   viewer   read only. This is what signing in with Microsoft grants.
--   auditor  runs calculations, uploads data, enters forecasts.
--   admin    adds users, reads the audit log, everything else.
--   superadmin kept for platform-level work across organisations.
--
-- Existing 'user' rows map to 'viewer', not 'auditor': least privilege is the
-- safe direction when re-mapping an enum, and the old shared account is being
-- replaced anyway.
--
-- SETTINGS
-- org_settings exists because the season start date lived only in React state,
-- initialised to an empty string and never persisted. parseDate('') returns
-- null, and new Date(null) is the epoch rather than an invalid date, so the
-- season silently began on 1970-01-01. Week-of-season then computed to ~2964,
-- which is past LATE_SEASON_WEEK, so every run dropped into wind-down mode and
-- returned zero for every centre. One unset field zeroed the whole app.
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

-- ── users: roles and sign-in provider ───────────────────────────────────────

-- Widen the enum before re-mapping, so no existing value becomes invalid.
ALTER TABLE `users`
  MODIFY COLUMN `role`
  ENUM('superadmin','admin','auditor','viewer','user')
  COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'viewer';

UPDATE `users` SET `role` = 'viewer' WHERE `role` = 'user';

ALTER TABLE `users`
  MODIFY COLUMN `role`
  ENUM('superadmin','admin','auditor','viewer')
  COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'viewer';

-- A Microsoft user never sets a password here, so the column has to allow NULL.
ALTER TABLE `users`
  MODIFY COLUMN `password_hash` VARCHAR(255) COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL;

CALL add_col_if_missing('users', 'auth_provider',
  'ENUM(''local'',''microsoft'') NOT NULL DEFAULT ''local''');

-- The Entra object id, not the email: an email can be renamed, the oid cannot.
CALL add_col_if_missing('users', 'microsoft_oid',
  'VARCHAR(64) DEFAULT NULL');

CALL add_col_if_missing('users', 'last_login_at', 'TIMESTAMP NULL DEFAULT NULL');

-- Unique so two accounts can never claim the same directory identity.
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
                AND INDEX_NAME = 'uq_users_microsoft_oid');
-- The no-op branch is a SET rather than a SELECT so a re-run prints nothing
-- and the deploy output stays readable.
SET @ddl := IF(@idx = 0,
  'ALTER TABLE `users` ADD UNIQUE KEY `uq_users_microsoft_oid` (`microsoft_oid`)',
  'SET @noop = 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ── org_settings: one row per organisation ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `org_settings` (
  `org_id` INT NOT NULL,
  -- The real season start. Null is allowed, but the app refuses to calculate
  -- without it rather than quietly treating it as the epoch.
  `season_start_date` DATE DEFAULT NULL,
  `season_total_days` INT NOT NULL DEFAULT 180,
  `seasonal_crushing_capacity` DECIMAL(16,2) DEFAULT NULL,
  `updated_by` INT DEFAULT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`org_id`),
  CONSTRAINT `fk_org_settings_org` FOREIGN KEY (`org_id`)
    REFERENCES `organizations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Give every existing organisation a settings row so reads never miss.
INSERT IGNORE INTO `org_settings` (`org_id`) SELECT `id` FROM `organizations`;

-- ── audit_log: what the admin reads ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `org_id` INT DEFAULT NULL,
  `user_id` INT DEFAULT NULL,
  `user_email` VARCHAR(255) DEFAULT NULL,
  `user_role` VARCHAR(32) DEFAULT NULL,
  `action` VARCHAR(64) NOT NULL,
  `entity` VARCHAR(64) DEFAULT NULL,
  `entity_id` VARCHAR(64) DEFAULT NULL,
  `detail` JSON DEFAULT NULL,
  `ip` VARCHAR(64) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_org_time` (`org_id`, `created_at`),
  KEY `idx_audit_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE add_col_if_missing;
