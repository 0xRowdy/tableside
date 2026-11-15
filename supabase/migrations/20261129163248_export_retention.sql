-- Retention rules for the server export's tables (#102, on #98's
-- private.retention_rules; Amendment 1 C6).

insert into private.retention_rules (subject, endpoint, dependency, owner) values
  ('private.exports',
   'A live export: until it ends, 24 hours after it was ready, or earlier when it is regenerated, a session is revoked or deletion is scheduled. '
     || 'An ended one stays a week after it ended, with no files, so the player is told why it ended; then it goes (export-upkeep).',
   'Its archive is removed from storage first, which only the Storage API can do (the export-job function): an ended row stays while object_pending.',
   'Export (#102); permanent deletion (#104) waits for it before removing the account''s rows'),
  ('private.export_parts',
   'A build''s temporary files: removed when its build finishes or fails, when its export ends, or 15 minutes after a build stops making progress (export-upkeep).',
   null, null);
