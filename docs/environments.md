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
- **Callbacks name their environment.** Auth redirects to `tableside://auth/<environment>`, and each project allows only its own. Apple's web flow (Android) carries the environment in its state, and `provider-callback` stores the flow only through a request naming that environment, so another project's flow is refused without a redirect.
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
6. Set up Apple and Google sign-in (#89). Provider secrets go only into the project (Auth's provider settings and function secrets), never into the repository or an app build.
   - **Auth:** enable the Apple provider with the bundle ID and the Services ID as client IDs (native iOS tokens carry the bundle ID, Apple's web flow on Android the Services ID), and the Google provider with the web and iOS client IDs. Leave the nonce check on for both.
   - **Function secrets** (`supabase secrets set`), read by `supabase/functions/_shared/id-token.ts`: `TABLESIDE_ID_TOKEN_APPLE_ISSUER=https://appleid.apple.com`, `TABLESIDE_ID_TOKEN_APPLE_AUDIENCES=<bundle ID>,<Services ID>`, `TABLESIDE_ID_TOKEN_GOOGLE_ISSUER=https://accounts.google.com`, `TABLESIDE_ID_TOKEN_GOOGLE_AUDIENCES=<web client ID>,<iOS client ID>`. Don't set the `KEYCLOAK` pair: that is the local test identity provider.
   - **Apple Services ID:** register `https://<project>.supabase.co/functions/v1/provider-callback?provider=apple` as its return URL.
   - **App build:** `EXPO_PUBLIC_TABLESIDE_APPLE_SERVICES_ID`, `EXPO_PUBLIC_TABLESIDE_GOOGLE_WEB_CLIENT_ID` and `EXPO_PUBLIC_TABLESIDE_GOOGLE_IOS_CLIENT_ID` (`apps/mobile/src/account/provider-ports.ts`). None is a secret. A build without one has no sign-in with that provider on that platform.

   Apple native on iOS, Apple through the browser on Android and Google native on both are qualified on devices at launch gate 3.
7. Point Auth's send-email hook at the project's `send-email` function (#100): in `[remotes.<environment>.auth.hook.send_email]`, `uri = "https://<project>.supabase.co/functions/v1/send-email?environment=<environment>"` and a new `secrets = "v1,whsec_<base64>"`, and set the same value as the function secret `TABLESIDE_SEND_EMAIL_HOOK_SECRET`. The URI names the environment, as every request does, so a hook pointed at another project's function is refused. Keep `double_confirm_changes` (Secure Email Change) on and `enable_manual_linking` off: fresh authentication depends on both (launch gate 4).

Gate 13 (environment isolation) is checked against both real projects before external beta invitations and again for production (#109).
