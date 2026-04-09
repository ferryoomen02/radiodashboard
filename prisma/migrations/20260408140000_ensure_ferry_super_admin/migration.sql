-- Idempotent: zorg dat dit account op productie/staging SUPER_ADMIN is (deploy = automatisch uitgevoerd).
UPDATE "User"
SET
  role = 'SUPER_ADMIN'::"Role",
  "stationId" = NULL,
  permissions = '[]'::jsonb
WHERE LOWER(email) = LOWER('ferry@ferryoomen.nl');
