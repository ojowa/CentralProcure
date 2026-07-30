-- Migration 114: Add missing columns to payments and contracts tables

BEGIN;

-- 1. Add missing columns to post_award.payments
ALTER TABLE post_award.payments
  ADD COLUMN IF NOT EXISTS payee_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'BankTransfer',
  ADD COLUMN IF NOT EXISTS closeout_eligible BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Backfill created_by from recorded_by
UPDATE post_award.payments SET created_by = recorded_by WHERE created_by IS NULL;

-- 2. Add contract_title to post_award.contracts as an alias column
ALTER TABLE post_award.contracts
  ADD COLUMN IF NOT EXISTS contract_title VARCHAR(255);

-- Backfill contract_title from tender_title
UPDATE post_award.contracts SET contract_title = tender_title WHERE contract_title IS NULL;

-- 3. Add a trigger to keep contract_title in sync with tender_title
CREATE OR REPLACE FUNCTION post_award.sync_contract_title()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contract_title IS NULL OR NEW.contract_title = '' THEN
    NEW.contract_title := NEW.tender_title;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_contract_title ON post_award.contracts;
CREATE TRIGGER trg_sync_contract_title
  BEFORE INSERT OR UPDATE ON post_award.contracts
  FOR EACH ROW
  EXECUTE FUNCTION post_award.sync_contract_title();

COMMIT;
