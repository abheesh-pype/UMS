-- Distinguish study-center invites from student self-enrollment invites. Existing rows stay 'center'.
ALTER TABLE "StudyCenterInvite" ADD COLUMN "inviteType" TEXT NOT NULL DEFAULT 'center';
