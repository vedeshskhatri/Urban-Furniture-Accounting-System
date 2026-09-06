-- seed-gstin.sql — assign format-plausible GSTINs to a realistic subset of
-- contacts so the GST Compliance Center can demonstrate B2B invoices,
-- inter-state IGST and Input Tax Credit eligibility.
--
-- Idempotent: only fills contacts that don't already have a GSTIN.
-- Deterministic: the same contact always gets the same GSTIN.
--
--   ~85% of vendors are registered (suppliers almost always are)
--   ~35% of customers are registered (corporate / office buyers; not walk-ins)
--
-- GSTIN layout: SS + PAN(5 alpha, 4 digit, 1 alpha) + entity(1) + 'Z' + check(1)

BEGIN;

UPDATE contacts c
SET gstin =
      -- state code
      (CASE
         WHEN lower(coalesce(c.state, '')) LIKE '%maha%' THEN '27'
         WHEN lower(coalesce(c.state, '')) LIKE '%gujar%' THEN '24'
         WHEN lower(coalesce(c.state, '')) LIKE '%rajas%' THEN '08'
         WHEN lower(coalesce(c.state, '')) LIKE '%karna%' THEN '29'
         WHEN lower(coalesce(c.state, '')) LIKE '%tamil%' THEN '33'
         WHEN lower(coalesce(c.state, '')) LIKE '%delhi%' THEN '07'
         ELSE '27'
       END)
      -- PAN: 5 alpha (hash-derived), 4 digit (id-derived), 1 alpha
      || upper(translate(substr(md5(c.name), 1, 5),
                         '0123456789abcdef', 'ABCDEFGHIJKLMNOP'))
      || lpad(((c.id * 137 + 11) % 10000)::text, 4, '0')
      || upper(translate(substr(md5(c.name || ':pan'), 1, 1),
                         '0123456789abcdef', 'ABCDEFGHIJKLMNOP'))
      -- entity number, fixed 'Z', checksum placeholder (hash-derived)
      || '1Z'
      || upper(translate(substr(md5(c.name || ':chk'), 1, 1),
                         '0123456789abcdef', 'ABCDEFGHIJKLMNOP'))
WHERE (c.gstin IS NULL OR c.gstin = '')
  AND ((c.id * 7 + 3) % 100)
        < (CASE WHEN c.type IN ('vendor', 'both') THEN 85 ELSE 35 END);

COMMIT;

-- Report
SELECT type,
       count(*)                                        AS total,
       count(*) FILTER (WHERE gstin IS NOT NULL AND gstin <> '') AS registered
FROM contacts
GROUP BY type
ORDER BY type;
