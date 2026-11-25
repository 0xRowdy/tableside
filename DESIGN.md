---
name: Tableside
description: A quiet card room for practicing and tracking blackjack, craps and roulette.
colors:
  background: "#0E1311"
  foreground: "#F3EFE6"
  card: "#161D1A"
  popover: "#1B2420"
  muted: "#1E2723"
  secondary: "#26312C"
  border: "#2C3832"
  controlBorder: "#6E7B74"
  mutedForeground: "#A9B2AC"
  primary: "#D4AE62"
  primaryForeground: "#1A1406"
  ring: "#D4AE62"
  onImage: "#FFFFFF"
  scrim: "#000000B3"
  correct: "#3FA877"
  destructive: "#E07A5F"
  warning: "#E8A23A"
  info: "#7FA8F5"
  felt: "#1B5A43"
  feltDeep: "#123F2F"
  feltText: "#F1EAD6"
  rail: "#3A2A1E"
  ink: "#1E1A14"
  inkMuted: "#5E574B"
  cardFace: "#FBF8F1"
  suitSpade: "#15171A"
  suitHeart: "#C8312F"
  suitDiamond: "#1F5FBF"
  suitClub: "#1C7A3E"
  chip1: "#EDE7D8"
  chip5: "#B83A33"
  chip25: "#2E7D4F"
  chip100: "#1D1F22"
  chip500: "#6A3FA0"
  chip1k: "#D99A2B"
  pocketRed: "#B83A33"
  pocketBlack: "#1D1F22"
  pocketGreen: "#2E7D4F"
  coach: "#F6F1E4"
  coachAccent: "#2563C8"
  mistake: "#E07A5F"
  mistakeInk: "#B4472C"
  primaryPressed: "#B08B45"
  coachPressed: "#E8E0CC"
  inkPressed: "#3A332A"
  pressShade: "#00000059"
typography:
  display:
    fontFamily: "Fraunces (Fraunces_400Regular)"
    fontSize: "32px"
    fontWeight: 400
  display-card:
    fontFamily: "Fraunces (Fraunces_400Regular)"
    fontSize: "36px"
    fontWeight: 400
  headline:
    fontFamily: "Fraunces (Fraunces_400Regular)"
    fontSize: "24px"
    fontWeight: 400
  figure:
    fontFamily: "Inter (Inter_700Bold)"
    fontSize: "36px"
    fontWeight: 700
  key:
    fontFamily: "Inter (Inter_600SemiBold)"
    fontSize: "24px"
    fontWeight: 600
  heading:
    fontFamily: "Inter (Inter_700Bold)"
    fontSize: "20px"
    fontWeight: 700
  body:
    fontFamily: "Inter (Inter_400Regular)"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "24px"
  secondary:
    fontFamily: "Inter (Inter_400Regular)"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "21px"
  label:
    fontFamily: "Inter (Inter_600SemiBold)"
    fontSize: "13px"
    fontWeight: 600
  caption:
    fontFamily: "Inter (Inter_400Regular)"
    fontSize: "12px"
    fontWeight: 400
  tab:
    fontFamily: "Inter (Inter_500Medium)"
    fontSize: "12px"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  card: "20px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primaryForeground}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-ghost:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
    height: "52px"
  segmented:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px"
  segment-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primaryForeground}"
    typography: "{typography.secondary}"
    height: "48px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "16px"
  notice:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "16px"
  sheet:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 20px 16px"
  tab-bar:
    backgroundColor: "{colors.card}"
    textColor: "{colors.mutedForeground}"
    typography: "{typography.tab}"
  tab-selected-pill:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    height: "30px"
    width: "56px"
  coach-note:
    backgroundColor: "{colors.coach}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  status-tag:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
  chip-rack:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "12px"
  playing-card:
    backgroundColor: "{colors.cardFace}"
    textColor: "{colors.suitSpade}"
    rounded: "{rounded.md}"
    size: "120px 168px"
---

# Design System: Tableside

## Overview

**Creative North Star: "The Private Card Room"**

Tableside is a practice room after hours. The lights are low, the room is a green so dark it reads as night, and the one bright thing is the table. Brass trim catches the eye only where a hand should go. Everything else (the chrome, the records, the settings) sits back in the dark and lets the felt, the cards and the numbers do the talking.

The mood is **calm, exact and warm**. Calm because players come here between casino trips to drill, not to be stimulated: nothing flashes, bounces or celebrates. Exact because the product's promise is honest records, so figures are stated plainly in bold Inter and never dressed up. Warm because the warmth comes from material, not effects: brass gold, a Fraunces serif on titles, cream card faces, and Marcus's notes on a sheet of cream paper.

Controls are **quiet and sure-footed**: big, plain targets, few borders, gold reserved for the one action that matters. The confirmed anti-references are **generic fintech** (cold white-and-blue cards and charts that forget this is a table game) and **sportsbook dashboards** (dense odds tickers, red/green money everywhere, urgency banners). Dark is the only MVP theme; every color is a named token so a light theme can arrive later without hunting hex values.

**Key Characteristics:**
- Green-black ground, never pure black; surfaces step up in lightness, never in shadow.
- One brass accent, used for the primary action, selection and progress.
- Fraunces for titles and moments, Inter for everything you read or operate.
- Real table materials (felt, rail, chips, card faces, pockets) carry their own colors, set apart from the app chrome.
- Accessibility is built into the palette: every essential pairing is listed and contrast-tested in code.

## Colors

A dark, low-chroma green neutral ramp with a single brass accent, plus a separate set of table-material colors that only appear on the table.

### Primary
- **Rail Brass** (`primary`, also `ring`): the primary button fill, the selected segment, the selected tab's icon and outline, switch-on, progress fills, banner actions and the keyboard focus ring. Text on it is **Brass Shadow** (`primaryForeground`), a near-black brown.
- **Seated Brass** (`primaryPressed`): a primary button while it is held. Never at rest.

### Neutral
- **After-Hours Green** (`background`): the room. Every screen's ground and the backdrop the table sits in.
- **Card Table** (`card`): the first step up: cards, the tab bar, the table summary row, banners.
- **Lamplit Panel** (`popover`): sheets, dialogs and the coaching panel, one step above cards.
- **Deep Baize** (`muted`): tracks and wells: the segmented control's trough, progress tracks, switch-off, device badges.
- **Felt Shadow** (`secondary`): secondary buttons, status tags, the selected tab's pill, icon circles and answer choices.
- **Hairline** (`border`): dividers and the tab bar's top hairline. Decorative only; never the sole boundary of a control.
- **Control Edge** (`controlBorder`): the 3:1 boundary of anything you can operate: fields, outline buttons, the segmented control, switch-off, the sheet grabber.
- **Linen** (`foreground`): primary text. Warm off-white, never pure white on chrome.
- **Smoke** (`mutedForeground`): secondary text, unselected tab labels and icons.
- **Scrim** (`scrim`, 70% black) and **Pure White** (`onImage`): only for text laid over photography (game cards) and behind modals.

### Status
- **Felt Green Check** (`correct`): saved, synced, correct answer. Always paired with an icon or word.
- **Terracotta** (`destructive`, and `mistake` in feedback): errors, failed records, Delete account, your wrong answer.
- **Amber** (`warning`): sync waiting, warning banner borders.
- **Soft Blue** (`info`): sync download only.

### Table materials
These belong to the table, never to the chrome.
- **Baize** (`felt`) and **Deep Baize Pocket** (`feltDeep`) for the playing surface; **Chalk** (`feltText`) for printed felt labels, hand totals and bet spots.
- **Walnut Rail** (`rail`) for the chip rack.
- **Card Face** (`cardFace`) with four distinct suit inks (`suitSpade` near-black, `suitHeart` red, `suitDiamond` blue, `suitClub` green). Four-color suits are intentional: they add a cue beyond red/black.
- Chip colors by denomination (`chip1` bone, `chip5` red, `chip25` green, `chip100` black, `chip500` purple, `chip1k` gold), with `ink` or white value text.
- Roulette pockets (`pocketRed`, `pocketBlack`, `pocketGreen`) with white numbers.

### Coaching paper
- **Coach Paper** (`coach`) with **Ink** (`ink`) and **Faded Ink** (`inkMuted`): Marcus's note card, the only light surface in the chrome. **Coach Blue** (`coachAccent`) outlines it and labels the kicker. **Correction Red Ink** (`mistakeInk`) marks a wrong answer on the paper. **Pressed Paper** (`coachPressed`) and **Pressed Ink** (`inkPressed`) show his actions while they are held.

### Named Rules
**The One Brass Rule.** Rail Brass marks the primary action, the current selection, progress and focus. It is never a background wash, a decorative border or a heading color. If two things on a screen are gold, one of them is wrong (focus rings excepted).

**The Table Is Not Chrome Rule.** Felt, rail, chip, pocket and suit colors appear only on table surfaces and real game objects. A settings card is never felt green; a chart bar is never a chip color.

**The Listed Pair Rule.** Every essential foreground/background pairing is declared in `essentialPairs` in `apps/mobile/src/theme/tokens.ts` and tested at 4.5:1 for text and 3:1 for graphics. A new pairing gets a new entry before it ships.

## Typography

**Display Font:** Fraunces, Regular 400 (`Fraunces_400Regular`)
**Body Font:** Inter, Regular 400, Medium 500, SemiBold 600 and Bold 700 (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`)

**Character:** Fraunces brings the soft, old-style warmth of a printed table layout; Inter does the work. The serif is for naming a place or a moment, and the sans is for anything read quickly or operated.

The web account page cannot load web fonts (its CSP sets `font-src 'none'`), so it uses the system UI stack with the same palette.

### Hierarchy
Sizes are roles, not numbers. Each role has a size per **text step** (Standard, Large and Larger), set by the player in More › Settings › Text size and in first run. Standard is the default and is tuned for older eyes at the phone's default text size. In code the ramp is `typeRamp` in `apps/mobile/src/theme/tokens.ts`; in `design/Tableside.pen` it is the `--text-*` variables on the `text` theme axis. See `docs/decisions/text-size-type-floor.md`.

| Role | Standard / Large / Larger | Face | Used for |
| --- | --- | --- | --- |
| `display` | 32 / 36 / 40 | Fraunces 400 | Screen titles on Home, first run, session results |
| `display-card` | 36 / 40 / 44 | Fraunces 400 | Game card titles over photography |
| `headline` | 24 / 27 / 30 | Fraunces 400 | Sheet and dialog titles, the blackjack decision title, lesson headings, the craps roll |
| `figure` | 36 / 40 / 44 | Inter 700 | The count readout and other big numbers |
| `key` | 24 / 26 / 28 | Inter 600 | Keypad digits |
| `heading` | 20 / 22 / 25 | Inter 700 | Card heads, prompts, the coach note headline, strip values |
| `body` | 17 / 19 / 21 | Inter 400; 600 for titles and buttons | Explanations, sheet text, row titles, button labels, the table top-bar title |
| `secondary` | 15 / 17 / 19 | Inter 400; 600 for segments | Row details, subtitles, segment labels, supporting copy |
| `label` | 13 / 15 / 16 | Inter 600 | Stat labels, kickers, strip labels, tags |
| `caption` | 12 / 14 / 15 | Inter 400–800 | Printed felt markings, header button labels, chart cells, chip values |
| `tab` | 12 at every step | Inter 500; 700 selected | Tab bar labels |

Numbers are Inter Bold, never serif, except the session result's headline figures, which use Fraunces. Kickers and labels are sentence case with no tracking. Only printed felt markings (DEALER, PASS LINE, ODDS) use capitals with tracking.

### Named Rules
**The Twelve Floor Rule.** Nothing on screen is smaller than 12 at Standard, including felt markings and chip values. If a label doesn't fit, the layout reflows, the label wraps or the copy gets shorter; the type never drops below its role.

**The Serif Names, Sans Works Rule.** Fraunces is used for titles and headline moments only, never for body text, buttons, labels or form input.

**The Read It In Linen Rule.** Text the player must read (instructions, questions, results, errors) is Linen. Smoke is for supporting detail only.

**The Scale Cap Rule.** The text step multiplies with the phone's text size: an element's size is `ramp[step][role] × system font scale`, with the system part capped by `maxFontSizeMultiplier`, `textScale.display` (1.5×) for Fraunces and `textScale.body` (2×) for Inter. Layout reflows to accept the growth, and type never shrinks to fit. The one exception is the tab bar label: it stays 12 and has a large-content viewer instead.

**The Presentation Only Rule.** The text step is saved per installation and is purely visual. It never changes scoring, timing, assistance, personal bests or which records are compared.

## Layout

A single scrolling column. `Screen` gives every page the After-Hours Green ground, safe-area insets plus a 24px side gutter, 16px gaps between blocks, and 32px bottom padding. The spacing scale is 4, 8, 12, 16, 24, 32, 48, 64; inner card padding is 16px, compact rows 12px.

Home is the exception: three full-bleed game cards stacked edge to edge with 2px seams, each filling its share of the height, and side by side when the window is wide. Tables are their own composition: a top bar with phase bars, one summary row, the felt, and the actions pinned above the tab bar (see `docs/decisions/table-chrome-summary-row.md`).

Every screen supports portrait and landscape on phones and tablets. Controls reflow vertically at large text sizes and in narrow windows instead of shrinking. At the Larger step, the table top bar wraps its title and status, blackjack actions go two per row, and paired buttons stack full width. The table summary row turns into key-value rows once the system font scale passes 1.35, and table actions unpin when they'd leave less than 120 pt of felt. Sheets turn full screen once the font scale passes 1.5×. Touch targets are at least 48×48 (`MIN_TOUCH_TARGET`) on both platforms, including segments, table action buttons and keypad keys; chip slots are 56.

The persistent bottom tab bar is the only global navigation: one row at every text size, hidden on pre-account and locked screens and under sheets.

## Elevation & Depth

Tableside is flat. There are no shadows or elevation values anywhere in the app. Depth comes from tonal steps: background → card → popover, each slightly lighter green, with Felt Shadow and Deep Baize for inset or tinted pieces. Modals sit on a 70% black scrim. The only gradient fades a game card's photo into its scrim band so the text stays legible.

A press goes the other way: the held control settles into its material. Brass goes to Seated Brass; Felt Shadow controls and pill buttons with no edge go to Deep Baize, and a control with no edge shows its Control Edge while held; rows, links and icon buttons take Felt Shadow; Marcus's actions take Pressed Paper and Pressed Ink. On the table, a piece darkens under **Press Shade** (`pressShade`, black at 35%) laid over its own colour and under its label: bet spots, craps and roulette spots shade their face, and a chip shades its slot on the rail, not its face. The change is instant: nothing scales, moves or animates. In code it is `pressStyle` (`apps/mobile/src/theme/press.ts`) and `PressShade` (`apps/mobile/src/play/TableChrome.tsx`); see `docs/decisions/press-feedback.md`.

### Named Rules
**The Lamplight Rule.** A surface is raised by making it lighter, never by casting a shadow. Something that needs to come forward moves up one tonal step (card → popover) or gets a Control Edge border.

**The Seated Press Rule.** A press darkens a control into its material and never fades it. Opacity means one thing: 40% is unavailable, and an unavailable control gives no press response. Keyboard focus keeps its own border, so a press never reads as focus.

## Shapes

Soft, rounded rectangles: `sm` 6 for card backs and small marks, `md` 10 for fields, outline buttons, the segmented control and playing cards, `lg` 16 for cards, notices, panels, sheets' top corners and the chip rack, and `pill` for buttons, tags, tab pills, chips and icon buttons. `card` 20 is reserved and rarely used.

Borders are thin (1–1.5px) and functional. Focus is a 2px border swapped to Rail Brass or Linen inside a transparent 2px border that is always reserved, so focus never shifts layout. Game cards use a 3px inset ring.

## Components

### Buttons
Quiet, wide and pill-shaped.
- **Shape:** full pill, at least 48px tall, 24px horizontal padding, an optional 18px Lucide icon with an 8px gap.
- **Primary:** Rail Brass fill, Brass Shadow label in Inter SemiBold `body` (17).
- **Secondary:** Felt Shadow fill, Linen label. **Ghost:** transparent, Linen label.
- **Outline:** the exception to the pill: 10px corners, 52px tall, 1px Control Edge border, `secondary` label. Used for list-like choices.
- **Long labels wrap** onto two lines rather than shrink. Two buttons that don't fit side by side stack full width, primary first.
- **States:** pressed seats the button: primary goes to Seated Brass, secondary and ghost go to Deep Baize and show their Control Edge, outline goes to Deep Baize. Unavailable is 40% with no press response. Keyboard focus turns the reserved 2px border Linen and wins over a press's edge. No scale, bounce or fade.

### Segmented control
- A Deep Baize trough with a Control Edge border, 10px corners and 4px padding. Each segment is at least 48px tall, with a `secondary` 600 label. A long label sizes its segment to the content.
- Selected: Rail Brass fill, Brass Shadow label and a check icon, so selection never relies on color alone. It is a radio group for screen readers.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Card Table; panels and dialogs use Lamplit Panel.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** none by default. A 1px status-colored border (Rail Brass, Terracotta, Amber) marks a notice or banner, always with an icon and title.
- **Internal Padding:** 16px; stat tiles 12px on 10px corners.

### Inputs / Fields
- Card Table or Lamplit Panel background, 1px Control Edge border, 10px corners.
- Error: the border turns Terracotta and an error line in Terracotta sits below; the draft is kept.

### Switch row
- A full-width row (at least 64px) with a bold title and a Smoke detail line, and a custom 52×32 switch. On: Rail Brass track, Brass Shadow knob with a brass check. Off: Deep Baize track, Control Edge border, Smoke knob.

### Sheets and dialogs
- Bottom sheet on Lamplit Panel with 16px top corners, a Control Edge grabber, a Fraunces 22px title and a 48px round close button on Felt Shadow. Slides up; becomes full screen at large text, padded clear of the status bar and home indicator.

### Navigation
- **Tab bar:** five tabs (Home, Play, Counting, Saved, More) on Card Table with a hairline top border. Community is the first row in More and has a Community button in the Home header. Each tab has a 22px Lucide icon over an Inter Medium `tab` (12) label, which stays 12 at every text step. Selected: the icon sits in a 56×30 Felt Shadow pill with a 1.5px Rail Brass outline, the icon turns brass, and the label turns Linen Bold. The iOS Large Content Viewer, or a long-press on Android, shows a big preview at large text sizes.
- **Table top bar:** Inter SemiBold `body` title (game and mode), a Linen `secondary` status line, round 48px icon buttons. Help (an icon over its `label`, always present) sits left of End session and opens the Help sheet: the game's lessons, the screen's hints and a line saying a lesson suspends the session. The title and status wrap instead of truncating. Below it, unlabelled 3px phase bars fill with Rail Brass as the turn advances.
- **Hub sections:** a top-level screen made of parts (Counting: Lessons, Challenges, Records) names each part with a 22px Lucide icon and an Inter Bold `heading` title on the ground, not inside a card. Cards inside a section keep their own `heading` titles. See `docs/decisions/lessons-entry-points.md`.
- **Challenge card choices:** the Learn and Check buttons show the icon and name over a Linen `secondary` line that says when feedback comes ("Feedback as you go", "Feedback at the end"), broken after "Feedback" so no word sits alone. They stack full width at Larger, where the line stays whole. See `docs/decisions/clarify-challenge-vocabulary.md`.

### Game card (signature)
Full-bleed photograph, a scrim band fading up from the bottom, a sentence-case `label` summary line, a Fraunces `display-card` title in white, and a 44px Rail Brass circle with an arrow. This is the one place photography appears.

### Coach note (signature)
Marcus speaks on paper: a Coach Paper card with 16px corners and a 1px Coach Blue border, Ink text, a Coach Blue sentence-case kicker, an Inter Bold `heading` headline, `body` text and Faded Ink detail. Its two actions stack full width when they don't fit side by side. Its primary action inverts to Ink with Coach Paper text. A wrong answer is marked in Correction Red Ink with an icon. It is the only light surface on a dark screen, so coaching reads as a separate voice from the game.

### Table pieces
- **Chip rack:** Walnut Rail panel with 48px round chips in denomination colors; the selected chip gets a 2px Rail Brass ring and a check mark. A held chip shades its slot under Press Shade and keeps its face.
- **Playing cards:** Card Face with four-color suits; empty card spots are dashed Chalk outlines on the felt. Cards don't grow with the text step; the layout picks the size. Table hands are Standard (58×82), and the card being counted is always Large (120×168), so it's never the smallest thing on screen.
- **Summary row:** up to three `label` captions over `heading` values and a chevron button; the whole row opens the Table details sheet (rules, house edge, guided strategy, Rebuy, counting aid). It becomes key-value rows with a labelled "Table details" row at large system text.
- **Count keypad:** 48px-minimum keys with `key` digits and a `figure` readout. Below them, Submit fills the row and Skip is a compact outline button. Every Skip opens "Skip this count?" (Keep counting, then Skip and score as incorrect) before anything is scored.
- **Bet spots:** Chalk boundary on felt; wagered spots get a 3px Card Face outline. A held spot darkens under Press Shade; its boundary and marker stay as they are.
- **Status tag:** Felt Shadow pill with an icon and Inter Bold `label` Linen text.

## Do's and Don'ts

### Do:
- **Do** keep the ground After-Hours Green (#0E1311) and raise surfaces by tone: card, then popover.
- **Do** spend Rail Brass on one thing per view: the primary action, the selection, progress or focus.
- **Do** pair every status color with an icon, word or shape. Suits use four colors and their pips; selections get a check.
- **Do** add a new foreground/background pairing to `essentialPairs` before using it, and keep text at 4.5:1 and graphics at 3:1.
- **Do** reserve a transparent 2px border on every focusable control so the focus ring doesn't shift the layout.
- **Do** give every `Text` a ramp role and a `maxFontSizeMultiplier`, and let layouts reflow at large sizes.
- **Do** check every screen at Standard with the phone at its default text size, and again at Larger with the largest system size.
- **Do** keep numbers in Inter Bold and say them plainly. Practice, simulation and casino figures sit in visibly separate places.
- **Do** say what a choice means on the choice itself, keep each note to one plain sentence, and lead a result with what went right. A reset or a slip comes after the scores.
- **Do** ask before an action that scores or records something the player can't take back. Name the action and its consequence on both buttons.
- **Do** show a press with `pressStyle` or `PressShade`: the control settles into its material and its label stays full strength.
- **Do** mark an earned readiness milestone with the brass seal on Lamplit Panel (S3-08 `ipoWU`); a personal best keeps its own box.

### Don't:
- **Don't** drift toward generic fintech: no cold white or blue-gray cards, no stock chart styling, no white backgrounds outside the coach note and card faces.
- **Don't** build sportsbook dashboards: no dense tickers, no red/green money coloring across a screen, no urgency banners or countdowns.
- **Don't** add shadows or elevation; use the next tonal step.
- **Don't** use opacity, scale or motion for a press. Opacity is for unavailable controls only.
- **Don't** celebrate: no confetti, bursts, glows or new sounds for a milestone, and nothing that rewards a net win.
- **Don't** use felt, rail, chip or pocket colors in app chrome.
- **Don't** set body text, buttons, labels or inputs in Fraunces.
- **Don't** go below 12, use all-caps kickers, or put must-read text in Smoke.
- **Don't** use pure black or pure white on chrome; Pure White is only for text over photos and on chips and pockets.
- **Don't** add a light theme or ad-hoc hex values; new colors are named tokens in `tokens.ts`.
- **Don't** ship a link to a screen that doesn't exist yet. Hide it until the screen lands; no "arrives in a later update" placeholders.
