INSERT INTO "ProgramAllocation" (
  "id",
  "organizationId",
  "centerId",
  "programId",
  "admissionSessionId",
  "allocatedBy",
  "allocatedAt",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  allocation."organizationId",
  allocation."centerId",
  allocation."programId",
  session."id",
  allocation."allocatedBy",
  allocation."allocatedAt",
  allocation."isActive",
  allocation."createdAt",
  allocation."updatedAt"
FROM "ProgramAllocation" allocation
JOIN "Program" program
  ON program."id" = allocation."programId"
JOIN "AdmissionSession" session
  ON session."organizationId" = allocation."organizationId"
  AND (
    session."programId" = allocation."programId"
    OR (
      session."programId" IS NULL
      AND (
        session."universityId" IS NULL
        OR session."universityId" = program."universityId"
      )
    )
  )
WHERE allocation."admissionSessionId" IS NULL
ON CONFLICT ("organizationId", "centerId", "programId", "admissionSessionId")
DO NOTHING;

DELETE FROM "ProgramAllocation" allocation
WHERE allocation."admissionSessionId" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "Program" program
    JOIN "AdmissionSession" session
      ON session."organizationId" = allocation."organizationId"
      AND (
        session."programId" = allocation."programId"
        OR (
          session."programId" IS NULL
          AND (
            session."universityId" IS NULL
            OR session."universityId" = program."universityId"
          )
        )
      )
    WHERE program."id" = allocation."programId"
  );
