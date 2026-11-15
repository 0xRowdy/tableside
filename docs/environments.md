# Backend environments

Beta and production are fully separate (spec 2 Amendment 1 A2; decision: [disposable beta and durable-service transition](decisions/disposable-beta-durable-service-transition.md)). Nothing from one ever reaches the other.

| Environment | Backend | App build | Device namespace |
| --- | --- | --- | --- |
| `local` | The local stack (`pnpm stack start`); `supabase/seed/local.sql` names it | Development builds | `local` |
| `beta` | Its own Supabase project, keys and Auth users | TestFlight and Play closed testing | `beta` |
| `production` | Its own Supabase project, keys and Auth users | Store releases | `production` |

## What keeps them apart

- **One backend per build.** A build's environment, endpoint and publishable key are fixed when it is built (`apps/mobile/src/account/backend.ts`), and nothing at run time can change them.
- **Every request names its environment.** The Account service sends `x-tableside-environment` on every request. The backend's PostgREST pre-request hook (`private.check_request_environment`) refuses any table, view or function request that names another environment, or none, with 403 `environment_mismatch`. A sign-up must name the environment too.
- **Every token carries its environment.** Auth's custom access token hook stamps each access token with the environment that issued it, and the authorization gate (`private.active_account`) refuses a token from another environment. Storage, which has no pre-request hook, is bound this way.
- **Every account carries its environment.** Accounts are stamped with the environment they were created in, and the authorization gate refuses an account from another environment, so another environment's data restored into a project can't be used.
- **Callbacks name their environment.** Auth redirects to `tableside://auth/<environment>`, and each project allows only its own.
- **Device data is namespaced.** Each environment has its own databases, keys and installation identity (the account vault) and its own credentials (`tableside.<environment>.auth*` in secure storage).
- **Production removes beta.** A store-track change can install a production build over a beta one and keep its data. Before a production build restores credentials, opens an account database or sends anything, the Account service removes the beta namespace: its credentials, then every database, sidecar, key and installation identity (`AccountVault.removeEnvironment`). Production sign-up then starts fresh, as a new account with a new installation identity.

Service credentials (the secret and service-role keys) never go into an app build. Each project has its own.

## Provisioning a project

Real projects don't exist yet; this is the checklist for when they do.

1. Create the project (Virginia, per #27) and link it: `supabase link --project-ref <ref>`.
2. Uncomment its `[remotes.<environment>]` block in `supabase/config.toml` and fill in the ref. The block turns off the test identity provider and the local seed, and sets the environment's callback URL.
3. Push the configuration and migrations: `supabase config push`, `supabase db push`.
4. Name the project's environment, once, as the database owner:

   ```sql
   insert into private.deployment (environment) values ('production'); -- or 'beta'
   ```

   Until this row exists, the project refuses every request and issues no tokens.
5. Build the app for it with `EXPO_PUBLIC_TABLESIDE_ENVIRONMENT`, `EXPO_PUBLIC_TABLESIDE_SUPABASE_URL` (HTTPS) and `EXPO_PUBLIC_TABLESIDE_SUPABASE_PUBLISHABLE_KEY` set to that project's values.

Gate 13 (environment isolation) is checked against both real projects before external beta invitations and again for production (#109).
