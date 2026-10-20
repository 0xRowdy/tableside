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

**Android** needs the Android SDK (`adb`, `emulator` on `PATH`) and either a connected device or an AVD. The harness starts the first AVD if nothing is connected.

The first device run builds the native app (several minutes). Later runs reuse the build caches.

## How it works

1. `packages/engine/test/suite.ts` lists the cases. Each case is synchronous and deterministic. It asserts with `t.equal` and records results with `t.record`, which every runtime must reproduce exactly. Outputs are canonical JSON: sorted keys, BigInts tagged. Values that could serialize differently, such as `NaN`, `undefined` or class instances, fail the case.
2. **Node leg:** the harness imports the suite and runs it with `runSuite` from `packages/harness/src/portable.ts`.
3. **Device legs:** the harness builds the app in **Release** with `EXPO_PUBLIC_ENGINE_HARNESS=1`, so it runs on the same bundled Hermes bytecode as a store build. That variable makes `apps/mobile/index.ts` boot `src/harness/HarnessApp.tsx` instead of the app. The harness app checks it is running on Hermes, runs the same suite, and POSTs the report to `http://127.0.0.1:8099/report/<run id>`, where the harness listens. Each run bundles a fresh id, so a harness app left over from an earlier run can't answer for this one. On Android, `adb reverse` forwards the port. The harness-only config plugin (`plugins/with-engine-harness.js`, applied when `ENGINE_HARNESS=1` at prebuild) allows that cleartext request to localhost.
4. `compareReports` checks the reports: every launch leg the command ran is present, every report comes from a launch runtime (so device reports ran on Hermes), every case passed everywhere, and every output matches the Node leg.

After an Android harness run, the generated `android/` project still carries the harness plugin's cleartext setting. Run `npx expo prebuild --clean --platform android` before making a local release build. EAS builds always prebuild from scratch.

## Adding cases

Every engine ticket extends the suite. Add a `*.cases.ts` file under `packages/engine/test/` (or extend one), export its `TestCase[]`, and add it to `suite.ts`. Take expected values from independent sources: the rules tables, published vectors such as the Random123 known-answer tests, or worked examples. Don't recompute them the way the code does.

Simulators and emulators run the real Hermes engine, but they don't replace the physical-device matrix in the spec 1 launch gates.
