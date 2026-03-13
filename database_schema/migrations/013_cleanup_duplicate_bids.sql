-- Cleanup: remove duplicate bids per vendor per tender (keeps earliest submission)
BEGIN;

WITH ranked AS (
    SELECT
        bid_id,
        ROW_NUMBER() OVER (
            PARTITION BY tender_id, vendor_id
            ORDER BY submission_date ASC, created_at ASC
        ) AS rn
    FROM vendor_sourcing.bids
)
DELETE FROM vendor_sourcing.bids
WHERE bid_id IN (
    SELECT bid_id FROM ranked WHERE rn > 1
);

COMMIT;
