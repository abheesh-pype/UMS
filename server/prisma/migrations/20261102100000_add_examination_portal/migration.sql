-- Server-side record of an examination's Exam Portal publication (was kept only in each browser's localStorage).
ALTER TABLE "examinations" ADD COLUMN "portal" JSONB;
