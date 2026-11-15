-- A local stack is the "local" backend environment. Beta and production
-- projects never run this seed: theirs is set once at provisioning
-- (docs/environments.md).
insert into private.deployment (environment) values ('local');
