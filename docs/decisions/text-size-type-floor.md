# Text size setting and type floor: accepted decision

Owner decision, 2026-11-18. The audience is likely older, and many players keep their phone at its default text size and read with glasses (PRODUCT.md, *Users*). Screens must be comfortable at the default size, not only once system text is raised. The frames came first: [#162](https://github.com/0xRowdy/tableside/pull/162) added the ramp and the Text size screens, and [#164](https://github.com/0xRowdy/tableside/pull/164) swept the S1–S7 frames to it. The code follows this note.

This note adds to `mobile-device-support-accessibility.md`, which already requires every flow to work at the largest system text and display sizes. Read with it.

## Type ramp

Every text size is a role. In `design/Tableside.pen` each role is a `--text-*` variable with one value per text step (theme axis `text`). In the app it is a role in `apps/mobile/src/theme/tokens.ts`. Nothing sets a raw point size.

| Role | Standard | Large | Larger | Face | Used for |
| --- | --- | --- | --- | --- | --- |
| `tab` | 12 | 12 | 12 | Inter 500 / 700 selected | Tab bar labels |
| `caption` | 12 | 14 | 15 | Inter | Felt markings, header button labels, chart cells, chip values |
| `label` | 13 | 15 | 16 | Inter 600 | Section and stat labels, kickers, tags |
| `secondary` | 15 | 17 | 19 | Inter 400 | Supporting detail, subtitles, row details, segment labels |
| `body` | 17 | 19 | 21 | Inter 400 / 600 | Body, row titles, button labels |
| `heading` | 20 | 22 | 25 | Inter 700 | Card heads, prompts, the coach headline, strip values |
| `key` | 24 | 26 | 28 | Inter 600 | Keypad digits |
| `headline` | 24 | 27 | 30 | Fraunces 400 | Sheet and decision titles |
| `display` | 32 | 36 | 40 | Fraunces 400 | Screen titles |
| `display-card` | 36 | 40 | 44 | Fraunces 400 | Game card titles |
| `figure` | 36 | 40 | 44 | Inter 700 | Count readout, big numbers |

## Rules

1. **Floor.** Nothing in the UI is smaller than 12 at Standard. That includes printed felt markings, chip values, chart cells and pucks. Playing-card glyphs are table objects sized by the card (see rule 8).
2. **Case.** Labels and kickers are sentence case. Printed felt markings (DEALER, PASS LINE, DON'T COME · BAR 12, ODDS) stay in capitals, because that is how the felt is printed.
3. **Must-read text uses foreground.** Smoke (`mutedForeground`) is for supporting detail only, never for an instruction, a question or a result.
4. **Three text steps: Standard, Large and Larger.** Standard is the default. The step multiplies with the phone's own text size: an element's size is `ramp[step][role] × system font scale`, and the system part is capped by the existing `textScale` caps (2× for Inter, 1.5× for Fraunces). Body at Larger on a phone set to its largest size is therefore at most 21 × 2 = 42.
5. **Saved per installation.** The step is stored locally on the device. It isn't part of the account, isn't synced and isn't in the account export. A new install starts at Standard and asks again.
6. **Presentation only.** The step never affects scoring, timing, assistance, personal bests, attempt comparison groups or which records are compared. A challenge attempt played at Larger is the same as one played at Standard.
7. **Tab labels stay 12** at every step and every system size. iOS uses the Large Content Viewer and Android a long-press label (spec 1 Amendment 1 A3 still applies). The tab bar stays one row.
8. **Cards don't grow with the step.** The layout picks the card size. In counting exercises the counted card is always Playing Card · Large (120 × 168) in every orientation, and the keypad tightens instead. Table hands stay Standard (58 × 82) so the felt fits. The counted card is never the smallest thing on screen.
9. **Touch targets.** Every control is at least 48 × 48, including segmented-control segments (44 before), table action buttons and keypad keys.
10. **Larger reflows.** The table top bar wraps its title and status. Blackjack actions go two per row. Controls stack before they shrink, and long button labels wrap. The table summary row turns into key–value rows at large system text (`table-chrome-summary-row.md`).

## Where the setting lives

- **First run, step 0, before Welcome** (S2-16, `Np7f0`). It needs no account, and every later screen, including age and sign-in, is read at the chosen size. The S2-16 flow (`zJjsp`) shows it for new and returning players.
- **More › Settings › Text size** (S1-12, `I886X`).
- Both show the three steps as a **radio group** (VoiceOver and TalkBack announce "1 of 3, selected"), with a live preview that renders real app text at the chosen step.

## Navigation: five tabs

Six labelled tabs at 12 filled the width, and "Community" clipped at 320 pt. The tab bar now has five destinations: **Home, Play, Counting, Saved, More**. Community is the first row in More and has a Community button in the Home header. Community screens select More. This replaces the six tabs in spec 2 Amendment 1 B4, and keeps #30's rule that extra destinations extend the tab bar through More.

## Spec amendments

Posted 2026-11-18: [spec 1 Amendment 12](https://github.com/0xRowdy/tableside/issues/51#issuecomment-6997826196), [spec 2 Amendment 10](https://github.com/0xRowdy/tableside/issues/52#issuecomment-6997826577), [spec 3 Amendment 6](https://github.com/0xRowdy/tableside/issues/53#issuecomment-6997827011) and [spec 6 Amendment 5](https://github.com/0xRowdy/tableside/issues/56#issuecomment-6997827387).

| Spec | Amendment |
| --- | --- |
| [#51](https://github.com/0xRowdy/tableside/issues/51) spec 1 | Amendment 1 A3: read "six-tab bar" as the five-tab bar. Tab labels stay 12 at every text step. Add **S1-12 Settings › Text size** under More › Settings. The Larger reflows for the top bar, session strip and blackjack actions (rule 10) apply. Table action buttons are 48 tall. |
| [#52](https://github.com/0xRowdy/tableside/issues/52) spec 2 | Amendment 1 B4: five destinations (Home, Play, Counting, Saved, More); More holds Community, Strategies, Settings and Help. First-run order (Amendment 3) gains **S2-16 step 0, Text size**, before Welcome, with no account. The setting is per installation: it isn't account data, isn't synced or exported, and isn't reset by sign-out. |
| [#53](https://github.com/0xRowdy/tableside/issues/53) spec 3 | **S3-04:** the counted card is Playing Card · Large (120 × 168) in every orientation, replacing the 58 × 82 portrait card. Amendment 2 §1 first-run order starts with the text size step. The text step never changes attempt comparison groups, personal bests or assistance (rule 6). |
| [#56](https://github.com/0xRowdy/tableside/issues/56) spec 6 | Community is reached from More and from the Home header, not from its own tab. Its screens select More in the tab bar. |

Decision records `mobile-visual-direction-core-navigation.md` and `mobile-device-support-accessibility.md` stay as written. The README's known-differences list records the change.
