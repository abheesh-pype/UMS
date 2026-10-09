ALTER TABLE "Organization"
ADD COLUMN "singletonKey" TEXT NOT NULL DEFAULT 'primary';

WITH ranked_organizations AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS row_number
  FROM "Organization"
)
UPDATE "Organization" AS organization
SET "singletonKey" = CASE
  WHEN ranked.row_number = 1 THEN 'primary'
  ELSE 'legacy-' || organization."id"
END
FROM ranked_organizations AS ranked
WHERE organization."id" = ranked."id";

CREATE UNIQUE INDEX "Organization_singletonKey_key"
ON "Organization"("singletonKey");

ALTER TABLE "University"
ADD COLUMN "singletonKey" TEXT NOT NULL DEFAULT 'primary';

WITH primary_organization AS (
  SELECT "id"
  FROM "Organization"
  WHERE "singletonKey" = 'primary'
  LIMIT 1
),
ranked_universities AS (
  SELECT
    university."id",
    ROW_NUMBER() OVER (
      ORDER BY
        CASE WHEN university."organizationId" = primary_organization."id" THEN 0 ELSE 1 END,
        university."id" ASC
    ) AS row_number
  FROM "University" AS university
  CROSS JOIN primary_organization
)
UPDATE "University" AS university
SET "singletonKey" = CASE
  WHEN ranked.row_number = 1 THEN 'primary'
  ELSE 'legacy-' || university."id"
END
FROM ranked_universities AS ranked
WHERE university."id" = ranked."id";

CREATE UNIQUE INDEX "University_singletonKey_key"
ON "University"("singletonKey");
