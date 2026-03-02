-- Fix Prisma migration directory renames: _pg_to_ch_ → _pg_to_ds_
-- Run this against the console production PostgreSQL database
-- after deploying the console code with renamed migration directories.

BEGIN;

-- 1. Update _prisma_migrations table (directory names)
UPDATE _prisma_migrations
SET migration_name = replace(migration_name, '_pg_to_ch_', '_pg_to_ds_')
WHERE migration_name LIKE '%_pg_to_ch_%';

-- 2. Update background_migrations table (script names + migration names)
UPDATE background_migrations
SET script = replace(script, 'Clickhouse', 'Datastore'),
    name = replace(replace(name, '_pg_to_ch', '_from_pg_to_ds'), '_from_from_', '_from_')
WHERE script LIKE '%Clickhouse%'
   OR name LIKE '%_pg_to_ch%';

COMMIT;

-- Verify
SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%pg_to_%' ORDER BY migration_name;
SELECT name, script FROM background_migrations WHERE name LIKE '%pg_to_%' ORDER BY name;
