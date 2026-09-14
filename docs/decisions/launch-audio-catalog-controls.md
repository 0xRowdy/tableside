# Launch audio catalog and controls — accepted decision

Planning for [Launch audio catalog and controls](https://github.com/0xRowdy/true-count/issues/49). Accepted through Q1–Q15 and Q17 in the live discussion on 2026-09-14. This is a planning decision: it selects the finite audio and haptic contract, not final asset production or app implementation.

## Accepted direction

- Ship **functional cues only** at MVP: a bounded catalog of short sounds that confirm game actions and feedback. No ambient loops, no music, no narration.
- **Casino atmosphere** is a separate, independently controlled track whose control and content ship together in a later release. The MVP Settings screen shows only Sound effects and Haptics.
- **Haptics** are part of this decision, paired with the same event families under their own control and subject to the same rules as sound.
- Two glossary terms govern the Check protection rule: an **event cue** marks that something happened without judging the learner; a **feedback cue** carries a judgment about the learner's answer or decision. A Check attempt plays event cues only; feedback cues and their haptics are withheld until results, exactly as on-screen feedback is.
- Every audio and haptic asset ships inside the app install. No downloaded or streamed audio; offline play sounds identical to online play, and no audio asset counts as content that must be prepared before offline game selection.

## Rejected for launch

- Narrated lessons and worked examples, spoken coaching during guided practice, and app-voiced card values during counting challenges. Platform screen-reader speech remains the accessibility path and is never counted as app narration.
- Background music and ambient loops in any screen.
- Casino atmosphere content or controls at MVP, including a placeholder loop.

## Accepted MVP cue catalog

Sixteen cues. Each is under one second except the wheel, which may run up to two seconds. A cue never delays or gates a state change, and a new cue may cut off a playing one.

| # | Cue | Kind | Where | Visible equivalent |
|---|-----|------|-------|--------------------|
| 1 | Card dealt or revealed | Event | Blackjack play, table challenges, card-value and running-count presentation | Card appears or is announced |
| 2 | Stake set or chip placed | Event | All games | Wager amount shown |
| 3 | Wager removed or returned | Event | All games, including final settlement returns | Wager list updates |
| 4 | Dice thrown | Event | Craps | Dice result shown |
| 5 | Wheel spun and ball landed | Event | Roulette | Winning number shown |
| 6 | Turn settled, net win | Event | All games, one per turn | Balance and results shown |
| 7 | Turn settled, net loss | Event | All games, one per turn | Balance and results shown |
| 8 | Turn settled, no net change | Event | All games, push or no action | Balance unchanged, results shown |
| 9 | Input rejected | Event | Illegal action, invalid stake, malformed count | Existing error message |
| 10 | Answer accepted | Event | All challenges, identical whether right or wrong | Entry clears, next content |
| 11 | Checkpoint due | Event | Running-count and table checkpoints | The count prompt itself |
| 12 | Attempt or session ended | Event | Results ready | Results screen |
| 13 | Correct | Feedback | Learn only | Correct mark shown |
| 14 | Incorrect | Feedback | Learn only | Explanation shown |
| 15 | Correction offered | Feedback | Guided practice and Play Learn deviation pause | Pause dialog |
| 16 | Readiness milestone or personal best | Feedback | Results screen only | Milestone shown |

Cues 6 through 8 fire once per turn on the turn's net result, so a craps roll settling several wagers plays one cue. Wager outcomes are event cues because they are visible settled game facts, not judgments of the learner's count or decision. Showing the reference count during a challenge gets at most a neutral toggle cue.

## Accepted haptic pairing

Nine cues also fire a haptic, using the standard platform patterns:

- Stake set and Answer accepted: selection tick.
- Dice thrown: medium impact. Ball landed and Attempt ended: light impact.
- Net win and Milestone: success. Net loss: heavy impact, deliberately not the platform "error" pattern.
- Input rejected and Incorrect in Learn: error. Correction offered: warning.

Card dealt has no haptic because it fires too often. Haptics for cues 13 through 16 are withheld during Check.

## Controls, defaults, and preference scope

- Controls live in Settings only. No quick mute on game or challenge screens; the device volume buttons, the silent switch, and Settings already provide three ways to go quiet, and the accepted per-screen layouts stay untouched.
- One **Sound effects** volume slider where zero is off. No separate event and feedback volumes. One **Haptics** on/off switch. The Casino atmosphere slider joins this group when its content ships.
- Sound effects default on at full app volume; haptics default on.
- The iOS Ring/Silent switch and Android silent or vibrate ringer mode silence every app sound. Haptics follow only the system haptics setting.
- Both preferences are device-local: not synced across devices, not in the account export, and not touched by account deletion beyond sign-out.

## Mixing, interruptions, and screen readers

- The app mixes with other audio and never ducks or pauses the player's music or podcast. It requests no Android audio focus and plays nothing while backgrounded.
- Phone calls and other interruptions need no resume logic: cues are under a second, and the existing challenge auto-pause already covers backgrounding.
- Screen-reader users get no automatic audio change. VoiceOver audio ducking is the user's own system setting, not an app behavior.

## Advertising

The Sound effects preference is forwarded to the ad SDK's app-level mute and volume settings before any ad request, so an interstitial after results respects it. Muted apps see fewer video ads; the advertising decision already treats ad revenue as unproven upside, so this costs nothing that was counted on. Ads never bypass the silent switch. This is an added release check under [Launch advertising provider and privacy controls](https://github.com/0xRowdy/true-count/issues/35), not a new ticket.

## Muted equivalents and cues outside play

- Every catalog entry names an existing visible state change or screen-reader announcement. No new visual indicator is added solely to mirror a sound, and state changes and their timing are identical with sound off.
- Worked examples reuse the play catalog exactly as in play. Onboarding, lesson text, community, records, settings, and account and subscription screens are silent. The attempt-ended cue fires only on arrival from an actual activity, never when reviewing history.

## Casino atmosphere: carried-forward requirements

Defined now so the later release does not reopen this decision. Content sourcing is later work.

- A second independent channel with its own volume and off control, separate from Sound effects.
- Bundled assets, the same silent-switch and mixing rules as sound effects, and foreground-only playback.
- It never carries game information and never replaces a cue.
- Defaults and per-game versus generic loops are decided when the content ships.

## Later releases

- **Casino atmosphere** content and its Settings control, per the requirements above.
- **Count by ear**: app-voiced card values during counting challenges for eyes-free practice. A new asset set and a new challenge presentation with its own pacing and assistance rules; not fog on the MVP map.

## Existing constraints

- Accepted mobile accessibility: no required information depends on audio, haptics, motion, or color alone; decorative effects never own game advancement; muted operation is already part of physical-device qualification.
- Accepted counting-challenge rules: Learn gives immediate feedback; Check defers correctness feedback until results except for the explicit reference-count reveal, which marks the attempt assisted. Audio changes none of this.
- Accepted content rights: audio assets are original, free-licensed, or reviewed AI-generated, with provenance recorded and no paid license. No specific generator, voice, or asset pack is selected here.
- Accepted visual direction and per-screen layouts remain unchanged; the Settings group is the only added control surface.

## Implementation acceptance checks

1. Every cue in the accepted catalog has the named visible equivalent, and each state change and its timing are identical with sound off, haptics off, and both off.
2. During a Check attempt, no feedback cue or haptic plays. The answer-accepted cue is byte-identical and fires at the same latency for right and wrong answers, verified by an automated test over correct and incorrect submissions.
3. The iOS silent switch and Android silent or vibrate ringer mode silence every app sound, including post-results ads. Haptics follow only the system haptics setting; Android system-haptic behavior is measured, not assumed.
4. Sound effects and haptics preferences are device-local: absent from synchronization payloads, the account export, and deletion handling.
5. Playing a cue never pauses, ducks, or takes audio focus from another app's audio. Backgrounding plays nothing.
6. The Sound effects preference is forwarded to the ad SDK's app-level mute and volume before any ad request.
7. Every shipped audio and haptic asset is bundled in the install; no cue depends on connectivity or offline content preparation.
8. Each audio asset has a provenance record under the accepted content-rights register: original, free-licensed, or reviewed AI-generated, with no paid license.
9. Cue durations stay within the accepted limits, and no cue gates or delays advancement.
10. The physical-device qualification runs already include muted audio; add sound-on runs with VoiceOver and TalkBack active to confirm cues never mask announcements. This amends the release scenarios under [Mobile device support and accessibility](https://github.com/0xRowdy/true-count/issues/25).

## Evidence

Platform facts verified against primary sources on 2026-09-14. Reverify exact pinned versions at implementation.

- [expo-audio](https://docs.expo.dev/versions/latest/sdk/audio/) is the current Expo library; [expo-av](https://docs.expo.dev/versions/v54.0.0/sdk/av/) is deprecated and removed from SDK 55. Local bundled sources are supported. `playsInSilentMode` defaults to `true`, so respecting the silent switch is an explicit setting. `interruptionMode` defaults to `mixWithOthers`, which requests no Android audio focus and is documented as best suited for sound effects. No JavaScript interruption or focus-loss event is documented.
- Apple [ambient](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/ambient) and [soloAmbient](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/soloambient) categories are silenced by the Ring/Silent switch; [playback](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/playback) is not. Apple's [playing audio guidance](https://developer.apple.com/design/human-interface-guidelines/playing-audio) says silent mode should silence game sound effects.
- Android [audio focus](https://developer.android.com/media/optimize/audio-focus) and [volume streams](https://developer.android.com/guide/topics/media-apps/volume-and-earphones): game audio uses the media stream; short-effect focus skipping is Expo's recommendation, not an Android rule.
- AdMob app-level mute and volume on [Android](https://developers.google.com/admob/android/global-settings) and [iOS](https://developers.google.com/admob/ios/global-settings) apply to interstitial, rewarded, banner, and app-open formats; muting reduces video-ad eligibility and is not forwarded to mediation networks, which this app does not use.
- [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) supports impact, notification, and selection feedback on both platforms; iOS honors the system haptics setting and Low Power Mode; Android system-haptic behavior is undocumented.
- VoiceOver [audio ducking](https://support.apple.com/guide/iphone/change-your-voiceover-settings-iphfa3d32c50/ios) is a user setting. React Native [AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo) can detect a running screen reader.
- Neither the [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) nor the [Google Play Developer Policy](https://play.google/developer-content-policy/) requires a mute control; Apple rejects apps that alter the Ring/Silent switch's function.

Final asset production, generator or voice selection, and production implementation remain separate work.
