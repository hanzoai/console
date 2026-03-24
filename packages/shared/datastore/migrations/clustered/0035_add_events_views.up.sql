-- Create events_core and events_full as views over observations table
-- The console code expects these table names for the new events model
CREATE VIEW IF NOT EXISTS events_core AS SELECT * FROM observations;
CREATE VIEW IF NOT EXISTS events_full AS SELECT * FROM observations;
