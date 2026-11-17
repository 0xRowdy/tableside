# Cross-runtime harness

The engine must produce identical results on every runtime it ships on: the Node runner, and the app's bundled Hermes on iOS and Android. The harness runs one engine suite on all three and fails if any case fails or any output differs.

## Running it

```sh
pnpm harness                              # Node, then iOS, then Android, then compare
pnpm --filter @tableside/engine test      # the Node leg only (what CI runs)
pnpm harness node --grep "BigInt"         # Node leg, cases whose name contains "BigInt"
pnpm harness ios                          # Node and iOS, compared
pnpm harness android                      # Node and Android, compared
pnpm harness compare harness-reports/*.json
```

Reports are written to `harness-reports/<platform>.json`.

**iOS** needs Xcode and a simulator. The harness uses a booted simulator, or boots the first available iPhone.

**Android** needs the Android SDK (`adb`, `emulator` on `PATH`) and an AVD. The harness runs on a running emulator, or boots the first AVD. It never picks a phone or network device (a TV box on adb over Wi-Fi, say) by itself; set `ANDROID_SERIAL` to a serial from `adb devices` to run on one.

The first device run builds the native app (several minutes). Later runs reuse the build caches.

## How it works

1. `packages/engine/test/suite.ts` lists the cases. Each case is synchronous and deterministic. It asserts with `t.equal` and records results with `t.record`, which every runtime must reproduce exactly. Outputs are canonical JSON: sorted keys, BigInts tagged. Values that could serialize differently, such as `NaN`, `undefined` or class instances, fail the case.
2. **Node leg:** the harness imports the suite and runs it with `runSuite` from `packages/harness/src/portable.ts`.
3. **Device legs:** the harness builds the app in **Release** with `EXPO_PUBLIC_ENGINE_HARNESS=1`, so it runs on the same bundled Hermes bytecode as a store build. That variable makes `apps/mobile/index.ts` boot `src/harness/HarnessApp.tsx` instead of the app. The harness app checks it is running on Hermes, runs the same suite, and POSTs the report to `http://127.0.0.1:8099/report/<run id>`, where the harness listens. Each run bundles a fresh id, so a harness app left over from an earlier run can't answer for this one. On Android, `adb reverse` forwards the port, and since Gradle's JS bundle task ignores environment variables, the leg deletes `android/app/build/generated/{assets,sourcemaps}/react` before and after its build; otherwise it reuses an app bundle for the harness, or leaves the harness bundle for a later app build. Each device leg runs `expo prebuild` with `ENGINE_HARNESS=1` first. The harness-only config plugin (`plugins/with-engine-harness.js`) then allows that cleartext request to localhost on Android, and on iOS the build leaves out Sign in with Apple, because Expo won't build a simulator app with that entitlement without a signing certificate.
4. `compareReports` checks the reports: every launch leg the command ran is present, every report comes from a launch runtime (so device reports ran on Hermes), every case passed everywhere, and every output matches the Node leg.

After a harness run, the generated native project still carries the harness settings: cleartext on Android, no Sign in with Apple on iOS. Run `pnpm exec expo prebuild --clean --platform <android|ios>` before making a local build of the app. EAS builds always prebuild from scratch.

## Adding cases

Every engine ticket extends the suite. Add a `*.cases.ts` file under `packages/engine/test/` (or extend one), export its `TestCase[]`, and add it to `suite.ts`. Take expected values from independent sources: the rules tables, published vectors such as the Random123 known-answer tests, or worked examples. Don't recompute them the way the code does.

The suite's oracles:

- **Random streams.** Philox4x32-10 vectors are the Random123 known-answer tests (`tests/kat_vectors`, the "philox4x32 10" rows). `ZERO` (key and session all zero) makes block 0 the first known answer (`6627e8d5 e169c58d bc57ac4c 9b00dbd8`); `PI` holds the key and session words of the "pi digits" known answer. Every application vector (shuffles, dice, spins, bounded draws) comes from `test/reference/philox_reference.py`, an independent implementation that asserts the known answers on import. Run it (`python3 -I packages/engine/test/reference/philox_reference.py`) for the ZERO and PI vectors, or use its `Stream`, `deck` and `shuffle` to read any stream's cards, dice or pockets before hand-working a trace.
- **Hashes.** SHA-256's "abc" and 448-bit digests are the FIPS 180-2 examples; the padding-boundary and UTF-8 digests come from Node's `crypto.createHash('sha256')`, as does the expected fingerprint of the hand-built canonical specification in `standardized.cases.ts`.
- **Roulette.** Payouts from #3 and the Wizard of Odds payout table; zero-adjacent placements from Wikipedia's "Roulette" inside bets; grid counts (57 number splits, 12 streets, 22 corners, 11 six lines) as published; the literal grid written out from the standard layout.
- **Blackjack strategy.** `TEST_POLICY`'s hard, soft and pair rows are the Wizard of Odds six-deck S17, double-after-split, late-surrender basic strategy ("4-8 decks"); its fallback rows are hand-derived. Its deviation thresholds are the certified S17 curriculum.
- **Strategy fixtures.** The engine can't import the definitions package, so its strategy fixtures are hand-written from spec 1's built-in strategy table, and `certified-blackjack.fixtures.ts` copies two shipped blackjack benchmark profiles and certified built-ins. Each must encode canonically the same as its shipped counterpart: the runner's test (`packages/runner/src/runner.test.ts`) replays the suite's traced sessions with the shipped built-ins and profiles, and fails if a fixture no longer matches one. Regenerate the certified copies from the definitions package when that data changes.

Simulators and emulators run the real Hermes engine, but they don't replace the physical-device matrix in the spec 1 launch gates.
