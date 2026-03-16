-- Migration 032: Post-Award Payments and Budget Expenditure (PostgreSQL)
BEGIN;

-- Add payment tracking columns to contracts
ALTER TABLE post_award.contracts
    ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS payment_recorded_at TIMESTAMP NULL;

-- Payments table
CREATE TABLE IF NOT EXISTS post_award.payments (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_reference VARCHAR(80) NOT NULL UNIQUE,
    contract_code VARCHAR(50) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'Paid',
    payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by VARCHAR(255) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payments_contract
        FOREIGN KEY (contract_code)
        REFERENCES post_award.contracts(contract_code)
        ON DELETE RESTRICT
);

-- Index for payment lookups
CREATE INDEX IF NOT EXISTS idx_payments_contract_code
    ON post_award.payments (contract_code, payment_date DESC);

-- Stored procedure to record expenditure and link to payment
CREATE OR REPLACE FUNCTION procurement_workflow.record_expenditure_sp(
    p_contract_code VARCHAR(50),
    p_amount NUMERIC(18,2),
    p_notes TEXT,
    p_recorded_by VARCHAR(255)
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_contract_id UUID;
    v_commitment_id UUID;
    v_expenditure_id UUID;
BEGIN
    -- Find commitment linked to the same tender title/vendor as this contract
    SELECT bc.commitment_id
    INTO v_commitment_id
    FROM procurement_workflow.budget_commitments bc
    WHERE bc.tender_id IN (
        SELECT tender_id FROM vendor_sourcing.tenders WHERE title = (SELECT tender_title FROM post_award.contracts WHERE contract_code = p_contract_code LIMIT 1)
    )
    AND bc.status IN ('Reserved', 'Committed')
    LIMIT 1;

    IF v_commitment_id IS NULL THEN
        -- Fallback: find by requisition_id if tender is missing
        SELECT bc.commitment_id
        INTO v_commitment_id
        FROM procurement_workflow.budget_commitments bc
        WHERE bc.requisition_id IN (
            SELECT requisition_id 
            FROM procurement_workflow.requisitions r
            JOIN post_award.contracts c ON c.tender_title = r.subject -- loose matching
            WHERE c.contract_code = p_contract_code
        )
        AND bc.status IN ('Reserved', 'Committed')
        LIMIT 1;
    END IF;

    -- Record the expenditure if commitment found
    IF v_commitment_id IS NOT NULL THEN
        INSERT INTO procurement_workflow.budget_expenditures (
            commitment_id,
            amount,
            spent_at,
            notes,
            created_by
        )
        VALUES (
            v_commitment_id,
            p_amount,
            NOW(),
            p_notes,
            p_recorded_by
        )
        RETURNING expenditure_id INTO v_expenditure_id;
    END IF;

    RETURN v_expenditure_id;
END;
$$;

-- Stored procedure to record payment
CREATE OR REPLACE PROCEDURE post_award.record_payment_sp(
    p_contract_code VARCHAR(50),
    p_amount NUMERIC(18,2),
    p_notes TEXT,
    p_recorded_by VARCHAR(255),
    OUT p_payment_id UUID,
    OUT p_payment_reference VARCHAR(80)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inspection_status VARCHAR(50);
    v_inspection_outcome VARCHAR(50);
    v_contract_status VARCHAR(50);
BEGIN
    -- 1. Validate contract status
    SELECT status INTO v_contract_status
    FROM post_award.contracts
    WHERE contract_code = p_contract_code;

    IF v_contract_status IS NULL THEN
        RAISE EXCEPTION 'Contract % not found.', p_contract_code;
    END IF;

    IF v_contract_status <> 'Completed' THEN
        RAISE EXCEPTION 'Contract % must be in Completed status before final payment.', p_contract_code;
    END IF;

    -- 2. Validate inspection outcome
    SELECT status, outcome INTO v_inspection_status, v_inspection_outcome
    FROM post_award.inspections
    WHERE contract_code = p_contract_code
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_inspection_status IS NULL OR v_inspection_status <> 'Accepted' OR v_inspection_outcome <> 'Accepted' THEN
        RAISE EXCEPTION 'Accepted inspection is required for contract % before payment.', p_contract_code;
    END IF;

    -- 3. Check if already paid
    IF EXISTS (SELECT 1 FROM post_award.contracts WHERE contract_code = p_contract_code AND is_paid = TRUE) THEN
        RAISE EXCEPTION 'Payment has already been recorded for contract %.', p_contract_code;
    END IF;

    -- 4. Generate reference
    p_payment_reference := CONCAT('PYMT-', TO_CHAR(NOW(), 'YYYYMMDD'), '-', UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6)));

    -- 5. Insert payment
    INSERT INTO post_award.payments (
        payment_reference,
        contract_code,
        amount,
        status,
        recorded_by,
        notes
    )
    VALUES (
        p_payment_reference,
        p_contract_code,
        p_amount,
        'Paid',
        p_recorded_by,
        p_notes
    )
    RETURNING payment_id INTO p_payment_id;

    -- 6. Update contract
    UPDATE post_award.contracts
    SET
        is_paid = TRUE,
        payment_recorded_at = NOW(),
        updated_at = NOW()
    WHERE contract_code = p_contract_code;

    -- 7. Record budget expenditure
    PERFORM procurement_workflow.record_expenditure_sp(p_contract_code, p_amount, p_notes, p_recorded_by);
END;
$$;

COMMIT;
