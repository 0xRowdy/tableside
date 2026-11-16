-- A local stack is the "local" backend environment. Beta and production
-- projects never run this seed: theirs is set once at provisioning
-- (docs/environments.md).
insert into private.deployment (environment) values ('local');

-- The export job's wake-ups go to the stack's API gateway, by its name inside
-- the stack's network (the same on every slot).
insert into private.job_endpoint (functions_url) values ('http://kong:8000');
