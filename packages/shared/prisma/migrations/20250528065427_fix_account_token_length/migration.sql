-- This is an empty migration.
ALTER TABLE "Account" ALTER COLUMN "access_token" TYPE TEXT;
ALTER TABLE "Account" ALTER COLUMN "refresh_token" TYPE TEXT;
ALTER TABLE "Account" ALTER COLUMN "id_token" TYPE TEXT;
