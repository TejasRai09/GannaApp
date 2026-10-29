-- ---------------------------------------------------------------------------
-- v2.1 — score the forecast, not the order.
--
-- Version 2 asked the plant team for their own indent number. That turned out
-- to measure nothing: the indent IS the plant team's decision, so asking them
-- to restate it only records the same number twice. Worse, the scorecard then
-- compared an ORDER against an ARRIVAL, and the app deliberately orders more
-- than it expects to receive (order = requirement / predicted yield), so the
-- app was penalised for following its own policy.
--
-- The real prediction buried inside an indent is: "if we order this much, how
-- much cane will actually come in?" That is exactly what the model predicts
-- (ml_maturity), and it is the one thing both sides can be scored on.
--
-- So each side now states an expected arrival, and both are judged against the
-- cane that actually turned up.
--   app_expected_arrival   = app_indent * ml_maturity
--   plant_expected_arrival = what the cane department expects to receive
--   plant_basis_indent     = the order their expectation assumes (defaults to
--                            the app's recommendation)
--
-- The basis is what makes the comparison fair: both predictions are converted
-- to an implied yield and re-stated against the indent ACTUALLY placed, so a
-- difference in assumed order size cannot decide the contest.
-- ---------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS add_col_if_missing;

DELIMITER //
CREATE PROCEDURE add_col_if_missing(
  IN tbl VARCHAR(64), IN col VARCHAR(64), IN def VARCHAR(255)
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

-- What the app expects to actually receive against its own recommendation.
CALL add_col_if_missing('indent_ledger', 'app_expected_arrival',
  'DECIMAL(14,2) DEFAULT NULL COMMENT ''app_indent * ml_maturity''');

-- What the plant team expects to actually receive.
CALL add_col_if_missing('indent_ledger', 'plant_expected_arrival',
  'DECIMAL(14,2) DEFAULT NULL COMMENT ''cane the plant team expects to arrive''');

-- The order their expectation assumes. Without this the expectation cannot be
-- turned into a yield, and yield is the only like-for-like unit.
CALL add_col_if_missing('indent_ledger', 'plant_basis_indent',
  'DECIMAL(14,2) DEFAULT NULL COMMENT ''indent the plant expectation is stated against''');

CALL add_col_if_missing('indent_ledger', 'expectation_entered_at',
  'TIMESTAMP NULL DEFAULT NULL');

DROP PROCEDURE add_col_if_missing;

-- Backfill the app side for days already in the ledger, so the first scorecard
-- is not empty. Safe to re-run: it only fills rows that are still NULL.
UPDATE indent_ledger
   SET app_expected_arrival = ROUND(app_indent * ml_maturity, 2)
 WHERE app_expected_arrival IS NULL
   AND app_indent  IS NOT NULL
   AND ml_maturity IS NOT NULL
   AND ml_maturity > 0;
