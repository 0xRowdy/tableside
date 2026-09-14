# Mobile device support and accessibility — accepted decision

Accepted through Q1–Q12 in the live discussion for [Mobile device support and accessibility](https://github.com/0xRowdy/true-count/issues/25), including the reviewed interaction prototype, physical-device matrix, and release evidence requirements. This is a planning decision; it does not certify an implemented app or completed native qualification.

## Accepted scope: Q1–Q9

- Support phones and tablets on iOS/iPadOS 16.4+ and Android 10+. Layouts adapt to available space; specialized tablet workflows may follow later. Android 10 is a product floor above the verified framework minimum.
- Support portrait and landscape throughout. Rotation preserves the current activity, entered answers, wagers, and pending inputs.
- Complete accessible operation is required at launch across blackjack, standard craps, roulette, counting challenges, strategy creation, and saved records. Include VoiceOver/TalkBack, system text scaling, contrast and non-color cues, reduced motion, alternatives to sound-dependent information, and simple controls replacing complex gestures.
- Provide a graphical table and an equivalent named bet selector available to everyone. The selector identifies the wager, relevant numbers, and amount; existing wagers have a readable list. Both presentations operate the same session. Controls reflow vertically on narrow screens and at large text sizes instead of shrinking.
- Operate at the largest system text and display settings on supported devices. Scrolling/reflow may be used. Minimum touch regions are 44 by 44 iOS points and 48 by 48 Android dp. Essential text has at least 4.5:1 contrast; essential graphical information and control boundaries have at least 3:1. Suits, selections, working/off states, errors, and results have explicit non-color cues.
- Default spoken-card presentation to self-paced, with explicit advancement. Automatic pacing must not silently skip cards or alter the selected speed. If speech cannot keep up, pause and explain; completed accuracy remains eligible, but fastest records follow the existing interruption exclusion.
- Speaking currently available information does not mark an attempt assisted. Accessibility must not reveal vanished-card history, concealed ranks, reference counts, or deferred Check feedback unavailable in the ordinary presentation. The explicit reference-count reveal retains the accepted assistance rule. Presentation does not erase first answers or alter game state/scoring.
- Core workflows must work through keyboard navigation and platform switch controls, including wager placement/removal and strategy editing/reordering. Provide visible focus, no focus traps, and simple alternatives to dragging, long presses, and complex gestures.
- In production builds on representative older supported devices, at least 95% of interactions acknowledge input within 100 ms; at least 95% of ordinary local game actions are durably saved and reflected within 250 ms; at least 95% of measured cold starts for an already signed-in account are usable offline within five seconds. Longer work shows progress, keeps navigation responsive, and preserves activity on interruption. These are targets, not measurements.

## Accepted table-control interaction: Q10

The user accepted the [standalone throwaway prototype](https://github.com/0xRowdy/true-count/blob/02decc7e217f7f95611213e72193f8b5d004c37c/docs/prototypes/mobile-accessibility.prototype.html) in Q10. It explores three bounded scenarios:

1. Select a roulette split on the graphical presentation, set its total stake, and edit the same wager using the named selector. Presentation changes do not place an additional wager.
2. Enter a Place 8 amount without submitting; change presentation and layout, then submit the preserved amount.
3. Explain why a pass-line wager committed to point 6 cannot be removed; contrast its behavior with removal of a legal place wager and return of that stake.

Accepted interaction details: selecting a region or a named wager opens an editor without placing a bet. The editor explicitly sets the wager's **total stake**, not an implicit addition. Submission applies the existing legality, funding, and coaching rules. Invalid input preserves the draft and existing wagers. Selecting another wager loads that wager's amount; changing only presentation/layout preserves the current draft. A committed-wager control explains why removal is unavailable. Removing a wager keeps focus at a meaningful location in the wager list.

This prototype contains a few illustrative roulette/craps wagers and no production game engine, outcomes, payouts, coaching, challenge assessment, or persistence. It is an interaction source, not an independent rules reference. Native screen-reader/switch behavior and OS scaling cannot be certified in a browser.

Browser verification performed: all three guided walkthroughs completed without JavaScript exceptions; final balances and wagers matched the fixture scenarios; 320 CSS-pixel width with 200% demo text had no horizontal document overflow after a wrapping/spacing fix; resizing to 1024 pixels retained an unsubmitted stake of 24. No native device or production performance validation has run.

## Accepted release qualification matrix: Q11

Use eight physical coverage roles. The models below are concrete candidates; verify actual model, installed OS/build, RAM, native ABI and successful installation with all chosen native dependencies before recording a specimen as qualified. A substitute must cover the same constraints rather than simply being newer/faster.

| Role | Candidate | Qualification purpose |
| --- | --- | --- |
| Older small iPhone | iPhone 8, iOS 16.x | Small layout and older CPU; record exact installed patch |
| Small current-OS iPhone | iPhone SE, second generation | Small layout with current stable platform/accessibility behavior |
| Older iPad | iPad, seventh generation, iPadOS 16.x | Older tablet performance and narrow multitasking layouts |
| Current-OS iPad | iPad Air 11-inch, M2 | Resizable windows, current accessibility, hardware keyboard |
| Constrained Android phone | Moto G7 Play, 2 GB, Android 10 | Older CPU, memory pressure, startup and small-screen controls |
| Current-OS Android phone | Pixel 9 | Current stable platform behavior, display/font scaling and gestures |
| Constrained Android tablet | Galaxy Tab A 8.0 (2019), SM-T295, 2 GB, Android 10 | Low-memory tablet and a second Android manufacturer's behavior |
| Current-OS Android tablet | Pixel Tablet | Adaptive windows and current tablet accessibility |

Supplement physical devices with simulators/emulators for the exact minimum OS, every intervening stable major OS family through launch, additional safe-area geometries, and dense/very narrow layouts. Test the exact floor using a compatible runtime or preserved physical specimen; a later patch is not silently equivalent. Missing floor coverage is an unresolved release gap. Physical performance and assistive-technology tests cannot be replaced by simulator results.

On every physical role, exercise both orientations, largest available system text combined with largest display scaling, the on-screen keyboard, reduced motion, muted audio, and rotation while editing. On old and current OS representatives of each platform, complete core workflows using VoiceOver/TalkBack, keyboard-only navigation, and switch-only navigation in separate runs. Tablets additionally resize between narrow and wide available windows during an active operation. Record exact viewport and settings; “largest” is not a fixed percentage across platforms.

The floor is a product support commitment. A failed required native adapter or unacceptable older-device performance triggers correction or an explicit reopening of coverage; it does not silently exclude devices while continuing to claim the same qualification.

## Accepted release evidence and failure handling: Q12

Require all supported operations to remain reachable and readable without depending on fine motor gestures, audio, animation, color alone, or table graphics. In a small window or with the software keyboard open, reflow and scroll the functional controls; graphical table detail may use the equivalent selector. Resizing alone does not restart an activity or mark a challenge interrupted; an actual pause retains its existing consequences.

Release scenarios include:

- Each launch game's legal actions and wager targets, including roulette multi-number selections and craps attached/committed/working-off bets; table and selector agree on current stakes, funding, and selected action.
- Blackjack split-hand navigation and active-hand identification, ordinary card exposure, concealed cards, and legal actions without revealing Check's prescribed action through labels, ordering, focus, or announcements.
- Each counting challenge category and Learn/Check/Observe/Play configuration: readable content and entry, first-answer retention, configured checkpoints, count-reveal assistance, speech backlog and pause/resume. Temporary card information has equivalent availability across presentations; no extra answer/history channel.
- Strategy conditions, nested all/any groups, editable progression lists, reordering, conflicts, fallback explanations, and saving incomplete drafts using all accepted input methods.
- Practice and casino records, rebuys, results, charts with equivalent textual values, account access/recovery, subscription actions, and community reporting/blocking. Third-party screens used in required flows are included in the accessibility walkthrough, not assumed accessible because supplied by a vendor.
- Pending wager/answer/draft preservation and meaningful focus through rotation, window resize, correction dialogs, background/recovery, and final settlement. Focus does not jump away on every balance announcement; announce concise relevant changes and expose details on demand.
- No optional motion/audio/haptic effect carries unique required information; reduced-motion presentation preserves legal exposure order and the selected challenge pace. Decorative effects never own game advancement.

Accepted performance protocol: on each older physical role, collect at least 100 samples per ordinary action family and 30 offline cold starts, using a production build, recorded OS/settings and representative saved data. Report each device/action family separately; compute the 95th percentile using sorted nearest-rank samples, without pooling a slow device into faster ones. Measure acknowledgement from input receipt to visible or accessible acknowledgement; measure action completion through durable commit and presentation. Show both times so an early acknowledgement cannot disguise slow saving. Cold start means process not running, previously signed in with prepared offline content, measured from launch to usable permitted activity navigation; first installation/sign-in is a separate functional scenario.

Include representative complex accepted strategies and recovery/history sizes; retain outliers. Write failures, crashes, missing input, hidden-information leaks and inaccessible required operations are functional failures, not discarded latency samples or ordinary slow-work exemptions. Long previews/settlements must yield and preserve progress; they are reported separately from ordinary action latency. No sampling/rule reductions or optimistic unsaved outcomes may be used to meet targets.

If a required scenario or target fails, correct and rerun affected checks before release, or explicitly reopen the product requirement. The initial acceptance is a release gate, not a promise that unmeasured candidates already pass.

## Evidence and remaining boundaries

- [Expo stable compatibility](https://docs.expo.dev/versions/latest/#support-for-android-and-ios-versions) and [SDK 57 release](https://expo.dev/changelog/sdk-57): investigated stable SDK 57 / React Native 0.86 support iOS 16.4+ and Android 7+, with Android compile/target API 36. [Android minimum versus target](https://developer.android.com/guide/topics/manifest/uses-sdk-element) distinguishes installability from platform behavior selection. Reverify exact pinned versions at implementation.
- [Expo SDK 57 native template](https://github.com/expo/expo/blob/sdk-57/templates/expo-template-bare-minimum/android/gradle.properties) retains armeabi-v7a and enables Hermes; [React Native 0.86.3 Hermes configuration](https://github.com/react/react-native/blob/v0.86.3/packages/react-native/ReactAndroid/hermes-engine/build.gradle.kts) also includes it. This supports considering 32-bit Android specimens; it does not establish final third-party native adapter compatibility.
- [Apple iOS/iPadOS 16.4 availability](https://support.apple.com/en-us/102880), [iPhone 8 specifications](https://support.apple.com/en-us/111976), [SE second-generation specifications](https://support.apple.com/en-us/111882), [iPad seventh-generation specifications](https://support.apple.com/en-us/111911). [Apple secure updates](https://support.apple.com/en-sa/guide/security/secf683e0b36/web) explains why arbitrary downgrades cannot be assumed possible.
- [Moto G7 Play specifications](https://en-in.support.motorola.com/app/answers/detail/a_id/137729/~/specifications--moto-g7-play) and [Android 10 manual](https://help.motorola.com/hc/3170/10/pdf/help-moto-g7-play-10-na-en-us.pdf); [Samsung Tab A specifications](https://www.samsung.com/ie/business/tablets/galaxy-tab-a/galaxy-taba-t295-sm-t295nzsabtu/) and [Android 10 update announcement](https://news.samsung.com/es/samsung-actualiza-sus-tablets-de-2019-con-android-10); [Android 16 compatible Pixel devices](https://developer.android.com/about/versions/16/get).
- [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility/), [Android touch targets](https://support.google.com/accessibility/android/answer/7101858?hl=en), [Android font scaling](https://developer.android.com/about/versions/14/features#non-linear-font-scaling), [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). These support specific acceptance criteria, not a complete compliance certification.
- [React Native accessibility](https://reactnative.dev/docs/accessibility), [Android accessibility testing](https://developer.android.com/guide/topics/ui/accessibility/testing), [Apple keyboard guidance](https://developer.apple.com/design/human-interface-guidelines/keyboards/), [Android Switch Access](https://support.google.com/accessibility/android/answer/6122836?hl=en).
- [Apple full-screen/window behavior](https://developer.apple.com/documentation/bundleresources/information-property-list/uirequiresfullscreen) and [Android 16 adaptive changes](https://developer.android.com/about/versions/16/behavior-changes-16) require native qualification. Android's large-screen orientation override has a games exception; both-orientation support here is an accepted product choice regardless of classification.

Broader visual direction, onboarding, audio catalog, tutorial curriculum, content/market/privacy review, and release scheduling remain outside this decision. The prototype does not reduce the three-game scope or implement the production app.
