# Account service: platform behavior

The Account service (`packages/account`), the app's account vault (`apps/mobile/src/account`) and the edge functions (`supabase/functions`) depend on library, platform and provider behavior their code can't show. Check the section for the code you change. Spec 2 and [development.md](development.md) hold the contracts; this holds the hazards.

## supabase-js and postgrest-js

- Making the client reads the stored credentials, so `connect()` makes it only after every retired environment's namespace is removed ([environments.md](environments.md) *Production removes beta*). Otherwise a beta session can be restored into a production build.
- The client's own session read renews an expired access token over the network and retries for about 30 s offline. Resume reads the stored session straight from storage, and server calls go only with an unexpired token; the player's own retry or answer renews first.
- Query builders are lazy thenables: `rpc(...)` sends nothing until it is awaited or `.then`-ed. To start a request now and await it later, wrap it in `Promise.resolve(...)`.
- postgrest-js reports a fetch that failed outright as HTTP status 0.
- `AuthRetryableFetchError` means Auth wasn't reached (offline), not that a refresh was refused.
- `Retry-After` is read through the client's fetch wrapper and attributed to the last call (`sync/supabase.ts`). That is correct only because the sync engine makes one backend call at a time.
- Realtime hands back a topic's existing channel until it has finished leaving, so a new connection waits for the old one. Private topics authorize with the session's current access token. The client keeps its socket open after the last channel is removed, so the service disconnects it explicitly.

## Supabase Auth

- Auth refuses to end a session (sign-out, current scope) for an expired access token, so `endServerSession` renews it first.
- Confirming the second address of a Secure Email Change also signs in. The service ends that new session at once (`/logout?scope=local`), so only the device's own remains.
- In the send-email hook, a Secure Email Change carries `token`, the code for the current address, and `token_new`, the code for the new one. `send-email` sends both or fails: a change only one address heard of can never complete.
- Admin `generate_link` sends no email, and Auth keeps one one-time code per user, so a sign-in on another device between issuing and verifying a code replaces it. `reviewer-sign-in` retries with a fresh code after a short random wait.
- When two `provision-reviewer` calls race for one address, admin create answers the loser with `email_exists` or a database error from the unique address. The function retries a failed create as "issue a credential", which succeeds if the other call made a reviewer account.

## PostgREST, Postgres and Storage

- **Request size.** The local stack's gateway (Kong 2.8, `client_max_body_size 0`) and PostgREST 14 impose no body limit, so the sync operations' own refusal is the request limit (`sync/protocol.ts`). The hosted project's proxy is qualified at launch gate 12 (spec 2 Amendment 1 C5).
- **Bootstrap time.** A bootstrap snapshot holds the account's synchronization head, so it must finish within an upload's `lock_timeout` (5 s in `sync_upload_v1`, mirrored by `UPLOAD_LOCK_TIMEOUT` in `test/bootstrap.test.ts`) and the API's 8 s statement timeout. Locally 100,001 practice summaries take about 2.2 s, about 2.5 s with 10,000 casino sessions besides. The hosted project is qualified at launch gate 12.
- `pg_stat_database.xact_rollback` (`transactions_rolled_back`) counts every aborted transaction since the statistics were last reset, so a scenario can assert only that it is non-negative, never a delta.
- Deleting rows from `storage.objects` doesn't remove the stored files. Ended exports and a deleted account's objects go through the Storage API, which is why `export-job` and `deletion-job` remove them, not SQL.

## Edge functions

- `clientIp` (`_shared/service.ts`) takes the last `X-Forwarded-For` hop, the one the Supabase gateway adds; earlier hops are caller-supplied and untrusted. Which hop is the client's on the hosted platform is checked at launch gate 9.
- The export archive's zip writer (`_shared/zip.ts`) has no zip64 support (one central directory, 32-bit sizes and offsets), so an archive must stay under 4 GiB.

## Apple and Google

- Apple and Google exchange a browser flow's authorization code only with the redirect URI it was issued for.
- Google writes its issuer as `https://accounts.google.com` and `accounts.google.com`, and in security events (RISC) as `https://accounts.google.com/`. `_shared/id-token.ts` accepts all three as Google's.
- Revoking an already revoked Google token answers 400 `invalid_token`, so `revokeGrant` treats a Google 400 as revoked.
- **Security events.** Apple posts `{ "payload": "<JWT>" }`, with the event as a JSON string in the `events` claim. Google posts the bare JWT (`application/secevent+jwt`), with events keyed by RISC type URI. Both retry on 5xx. `provider-notifications` answers 202 to every valid event, unknown subjects included, so the answer reveals nothing. The test identity provider (`src/testing/identity-provider.ts`) sends both shapes.
- **Native Google sign-in** is the local module `apps/mobile/modules/google-sign-in`, because the free Google Sign-In package for React Native takes no nonce. It calls Credential Manager on Android and GoogleSignIn 9 on iOS, the first iOS SDK with a nonce parameter. `clientId` is the iOS OAuth client (unused on Android); `serverClientId` is the web client whose tokens Auth verifies. On iOS it returns to the app through the iOS client's reversed client ID as a URL scheme (`123-abc.apps.googleusercontent.com` becomes `com.googleusercontent.apps.123-abc`), which `plugins/with-google-sign-in.js` adds; a build without the iOS client ID adds none.

## Credentials and the account vault

- Expo SecureStore (the iOS Keychain, Android's SecureStore) can't list its entries. Each entry's name is recorded in an index before the entry is written: credentials in `tableside.<environment>.credentials` (`namespacedCredentials`), vault keys in `tableside.<environment>.keys`. Removing an environment or erasing an account walks the index; it is the only way to find keys whose files are gone.
- Credential writes go one at a time (`writeCredentials`), so a token renewal that finishes late can't write its token back after a sign-out cleared it.
- **Write order** survives a kill between any two writes:
  - The installation's secret is stored on the device before `register_device_v1` sends it, so a lost answer or a kill never strands the installation. The web account page does the same.
  - On lock, the signed-out marker is written before the credentials are removed, so the app still reopens locked.
  - `removeNamespace` removes keys before files, since the files are how key names are found. `eraseAccount` removes files before keys: a key outliving its database is harmless, the reverse is Recovery needed. Recovery writes the new database's key first, so the next open creates the database rather than treating the kept original as one without its key.
  - In migration (`migration-runner.ts`), `MigrationFiles.move` must be an atomic rename (target absent or whole). Restoring a backup moves the database file before its WAL, so an old log is never applied to the backup, and keeps the damaged bytes as `.unreadable-<n>`. Discarding a backup removes the manifest last, so a backup never outlives it unnoticed.
- The installation ID counts only when the vault file and the device-only keychain entry agree, so restored files, or keychain entries that survive a reinstall, never revive an identity. A database left by an earlier installation is never opened or replaced (Recovery needed).
- **SQLCipher.** `native-vault.ts` opens its own connection, never Expo's shared cached one, sets the key before any other statement, and refuses to open when the build lacks SQLCipher: there `PRAGMA key` silently does nothing and the database would be stored unencrypted.
- **Backup exclusion.** `apps/mobile/plugins/with-backup-exclusion.js` writes Android's full-backup-content (Auto Backup, Android 11 and lower) and data-extraction-rules (cloud backup and device transfer, Android 12+), excluding the vault directory and SecureStore's preferences. It replaces expo-secure-store's own rules, hence `configureAndroidBackup: false` in `app.config.ts`.
- On launch the iOS keychain can still be locked, so resuming the account can fail. `AccountProvider` ignores that rejection; the next return to the foreground resumes.

## Coupling with the app

- The sync engine recognizes the app's disk-full `SqlError` by its shape (`kind: 'full'`, `isAccountStoreDiskFull`), since the package can't import the app. Renaming that kind in the app silently breaks full-disk handling.
- `src/testing` imports the app's account store and practice controller by path. The dependency goes only that way (the app never depends on the test harness); don't make it a package dependency.
- React Native's `URL` on Hermes is incomplete, so `sign-in.ts` builds URLs and query strings by hand.
- **Crash reports.** V8 and Hermes start `error.stack` with `name: message`, and the message can span lines shaped like frames, so `crash-report.ts` cuts the message off before parsing frames. A report keeps an error's `kind` or `code` only when it is a few hyphenated words with no digits (`refused`, `cipher-missing`), so an attempt or record id set as a kind never leaves the device (spec 3 launch gate 2). JavaScriptCore frames are `name@location`.

## Seam 2 scenarios

- All scenarios share one local stack, and Auth's per-IP rate limits make parallel test files flaky, so `fileParallelism` stays false (`vitest.config.ts`).
- Right after `supabase start`, Realtime accepts subscriptions before it delivers database broadcasts (`realtime.send`), and each edge function boots its worker on its first request. The global setup (`test/stack-ready.ts`) waits for a broadcast round trip and sends each function an OPTIONS preflight, so first-run scenarios don't fail or time out.
- The host clock can drift from the database's by more than a send takes, so scenarios mark their start with the database clock (`src/testing/stack.ts`).
- The test identity provider's client ID and secret must match `[auth.external.keycloak]` and `TABLESIDE_GRANT_KEYCLOAK_CLIENT_SECRET` in `supabase/config.toml`. Auth reaches it from its container through the host gateway (`host.docker.internal`).
