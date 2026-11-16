-- ---------------------------------------------------------------------------
-- Store each run's headline totals.
--
-- The history list deliberately returns runs WITHOUT results_json, because
-- results are megabytes each. But the list shows "Total Indent" per row, which
-- was computed by summing tableData — a field the list does not carry. Every
-- row therefore displayed 0.00 Qtls, which reads as "nothing was saved".
--
-- Fetching results for every row to fix the display would reinstate the
-- hundred-megabyte response that was just removed. So the totals are computed
-- once, when the run is saved, and stored beside it.
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

CALL add_col_if_missing('calculation_runs', 'total_indent',
  'DECIMAL(18,2) DEFAULT NULL COMMENT ''sum of tableData[].indentToRaise''');
CALL add_col_if_missing('calculation_runs', 'centre_count',
  'INT DEFAULT NULL COMMENT ''number of centres in the run''');

DROP PROCEDURE add_col_if_missing;

-- Backfill the runs already stored. JSON_TABLE walks tableData inside the
-- database, so the results never travel anywhere. Safe to re-run: it only
-- touches rows whose total is still NULL.
UPDATE calculation_runs c
   SET c.total_indent = (
         SELECT COALESCE(SUM(jt.v), 0)
           FROM JSON_TABLE(
                  c.results_json, '$.tableData[*]'
                  COLUMNS (v DECIMAL(18,4) PATH '$.indentToRaise')
                ) AS jt
       ),
       c.centre_count = COALESCE(JSON_LENGTH(c.results_json, '$.tableData'), 0)
 WHERE c.total_indent IS NULL
   AND c.results_json IS NOT NULL;
