# Trusted device time and boot continuity

Research date: 2026-09-06. Decision ticket: [Local persistence and account synchronization architecture](https://github.com/0xRowdy/true-count/issues/21).

## Finding and status

There are credible native mechanisms for measuring elapsed time through sleep and distinguishing process restart from device reboot. The proposed Expo native adapter below has not been implemented, qualified on devices, or accepted by the user. It does not establish a tamper-proof clock.

Subsequent decision: the user accepted native continuity adapters in Q10 and the integrated protocol in Q15 of [persistence and synchronization](../decisions/local-persistence-account-synchronization.md). The original research language below records the proposal before acceptance; physical-device qualification remains outstanding.

The accepted [mobile architecture](../decisions/mobile-platform-shared-game-engine.md) requires reliable boot continuity before reusing a persisted elapsed-time anchor. The [offline lifecycle](../decisions/offline-access-subscription-lifecycle.md) requires reconnection when deadline validity is uncertain, while preserving permitted completion, final settlement and saved-history access. A lower counter detects some reboots but cannot prove that a higher counter belongs to the same boot.

## Primary-source evidence

| Mechanism | Evidence and limits |
| --- | --- |
| iOS sleep-inclusive elapsed time | Apple's public [Mach header](https://github.com/apple/darwin-xnu/blob/main/osfmk/mach/mach_time.h) declares `mach_continuous_time` available from iOS 10 and specifies that it advances during sleep. It also exposes `mach_timebase_info` for unit conversion. This is elapsed time, not independently trusted wall time or boot identity. |
| iOS reboot marker | A [May 2023 Apple DTS recommendation](https://developer.apple.com/forums/thread/110044?answerId=754364022) combines sleep-inclusive `CLOCK_MONOTONIC` with an app-group-namespaced POSIX semaphore. Exclusive creation distinguishes a missing marker from an existing one; the marker persists across process exits. DTS describes cleanup on reboot as a reasonable assumption, not a formal secure-clock guarantee. This is evidence for native investigation, not completed qualification. |
| iOS semaphore namespace | Current [App Groups entitlement documentation](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.application-groups) documents `<group identifier>/<unique name>` and the `PSEMNAMLEN` length limit. DTS specifies 31 UTF-8 characters, requiring a short registered app-group identifier and correct entitlement. |
| Unavailable iOS boot UUID | Apple's [iOS 18 release notes](https://developer.apple.com/documentation/ios-ipados-release-notes/ios-ipados-18-release-notes) state that `kern.bootsessionuuid` is no longer available to apps. Do not build the adapter around it. |
| Insufficient iOS alternatives | [`systemUptime`](https://developer.apple.com/documentation/foundation/processinfo/systemuptime) measures awake time. [Apple DTS](https://developer.apple.com/forums/thread/101874) confirms that it excludes sleep and that `kern.boottime` changes with the system clock. Neither is sufficient standalone continuity evidence. |
| Android | [`SystemClock.elapsedRealtime()`](https://developer.android.com/reference/android/os/SystemClock#elapsedRealtime()) includes deep sleep and is monotonic within a boot. [`Settings.Global.BOOT_COUNT`](https://developer.android.com/reference/android/provider/Settings.Global.html#BOOT_COUNT) is a public boot count introduced in API 24. Their combination is a candidate for continuity across process restarts; failed reads, changed installation identity or changed boot count require uncertainty. These APIs do not certify behavior on compromised devices. |

## Proposed adapter and crash handling

This protocol is an engineering inference from the sources above, not Apple's sample or an accepted implementation decision. Native code owns the readings and continuity checks; the portable game engine has no clock dependency.

Establish an anchor from a successful trusted server response and a native elapsed-time reading. Bind it to the installation, its account/access context, the clock protocol version and the response's unchanged deadlines. Bound request uncertainty conservatively; delayed responses must not extend an expiry. Do not reconstruct a trusted anchor from the displayed clock.

On iOS, create a new exclusively allocated semaphore marker for each replacement anchor, then atomically persist its name with that anchor. Offline recovery opens the recorded marker **without creating it**. A missing marker, API error, counter regression or identity mismatch invalidates reuse. Never recreate a missing marker while retaining the old anchor: a crash before recording invalidation could otherwise make stale time look trustworthy. Serialize anchor replacement and retain the old marker until its replacement commits. Clean obsolete markers afterward, with crash-recoverable bookkeeping and no unbounded leak. Keep the namespace within the documented limit and verify collision handling.

On Android, persist the successful boot-count reading with the anchor and installation identity; reuse only when those still match and the elapsed reading is valid. A reboot cannot continue the previous anchor merely because its new uptime exceeds the old reading.

Neither platform may turn restored files, leftover secure-storage entries, reinstall or a new allowance device into fresh verification time or another daily training allowance. Keep raw clock anchors and marker identities device-local. The adapter must distinguish uncertain time from an independently confirmed expired deadline.

## Native acceptance matrix

Run against the pinned Expo/native build on supported physical iOS and Android devices. These are required proposed checks, not passing results.

| Scenario | Required observation |
| --- | --- |
| Background, device lock and long sleep | Elapsed time includes sleep; an expired deadline is not extended. Same-process resumption needs no invented new anchor. |
| Force-quit and relaunch without reboot | Existing iOS marker or matching Android boot count supports reuse of the same valid anchor without mandatory reconnection. |
| Reboot, including new uptime greater than old uptime | Old anchor is rejected; permitted recovery/final settlement remains possible. |
| Manual clock/timezone changes and automatic clock correction | No extension of premium or training-allowance deadlines and no duplicate grant. |
| Crash before/after marker creation, anchor commit and old-marker cleanup | Recovery selects a valid committed anchor or uncertainty; it never revalidates an old anchor by recreating its marker. Repeated failures do not exhaust markers. |
| Missing entitlement, namespace collision, API/read failure or missing marker | Explicit uncertainty; no silent wall-clock fallback. |
| App update, skipped versions and native module change | Preserve valid continuity only with compatible evidence; do not silently reinterpret anchor units/protocol. |
| Reinstall, backup restore, device transfer and account switch | Installation/account binding prevents stale access restoration or allowance duplication. |
| Slow or interrupted server verification | No inferred successful verification and no extension from response delay; retries preserve grant/operation identity. |

## Direct privacy API implications

Apple's current [required-reason API list](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype) names `systemUptime` and `mach_absolute_time` for system boot time; it does not list `mach_continuous_time` or `clock_gettime` in that category. Do not infer a mandatory declaration for the proposed calls solely from that list. Audit the actual native implementation and dependencies. If covered APIs are used, declare their actual approved purpose; reason `35F9.1` covers elapsed intervals/timers and restricts off-device data, with an exception for elapsed intervals between in-app events.

## Remaining decision

Qualify the semaphore assumption, sandbox behavior, short namespace, cleanup and anchor transaction protocol before promising offline continuity across iOS process restarts. If this approach fails and no adequate alternative is established, reconnecting after every process restart is a possible conservative fallback. That materially narrows offline usability and requires explicit product approval; this research does not silently adopt it. Reconnection after genuine continuity uncertainty remains the accepted policy.
