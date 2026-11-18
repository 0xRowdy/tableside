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
typography:
  display:
    fontFamily: "Fraunces (Fraunces_400Regular)"
    fontSize: "30px"
    fontWeight: 400
  display-card:
    fontFamily: "Fraunces (Fraunces_400Regular)"
    fontSize: "34px"
    fontWeight: 400
    lineHeight: "38px"
  headline:
    fontFamily: "Fraunces (Fraunces_400Regular)"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: "28px"
  title:
    fontFamily: "Inter (Inter_700Bold)"
    fontSize: "16px"
    fontWeight: 700
  body:
    fontFamily: "Inter (Inter_400Regular)"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  body-small:
    fontFamily: "Inter (Inter_400Regular)"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
  stat:
    fontFamily: "Inter (Inter_700Bold)"
    fontSize: "24px"
    fontWeight: 700
  label:
    fontFamily: "Inter (Inter_700Bold)"
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.5px"
  label-medium:
    fontFamily: "Inter (Inter_500Medium)"
    fontSize: "11px"
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
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    height: "48px"
  button-ghost:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.title}"
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
    height: "44px"
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
    typography: "{typography.label-medium}"
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

### Neutral
- **After-Hours Green** (`background`): the room. Every screen's ground and the backdrop the table sits in.
- **Card Table** (`card`): the first step up: cards, the tab bar, the session strip, banners.
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
- **Coach Paper** (`coach`) with **Ink** (`ink`) and **Faded Ink** (`inkMuted`): Marcus's note card, the only light surface in the chrome. **Coach Blue** (`coachAccent`) outlines it and labels the kicker. **Correction Red Ink** (`mistakeInk`) marks a wrong answer on the paper.

### Named Rules
**The One Brass Rule.** Rail Brass marks the primary action, the current selection, progress and focus. It is never a background wash, a decorative border or a heading color. If two things on a screen are gold, one of them is wrong (focus rings excepted).

**The Table Is Not Chrome Rule.** Felt, rail, chip, pocket and suit colors appear only on table surfaces and real game objects. A settings card is never felt green; a chart bar is never a chip color.

**The Listed Pair Rule.** Every essential foreground/background pairing is declared in `essentialPairs` in `apps/mobile/src/theme/tokens.ts` and tested at 4.5:1 for text and 3:1 for graphics. A new pairing gets a new entry before it ships.

## Typography

**Display Font:** Fraunces, Regular 400 (`Fraunces_400Regular`)
**Body Font:** Inter, Regular 400, Medium 500 and Bold 700 (`Inter_400Regular`, `Inter_500Medium`, `Inter_700Bold`)

**Character:** Fraunces brings the soft, old-style warmth of a printed table layout; Inter does the work. The serif is for naming a place or a moment, and the sans is for anything read quickly or operated.

The web account page cannot load web fonts (its CSP sets `font-src 'none'`), so it uses the system UI stack with the same palette.

### Hierarchy
- **Display** (Fraunces 400, 30px): screen titles on Home, first run, session results. Game cards use a larger 34/38.
- **Headline** (Fraunces 400, 22–26px, ~28–32 line height): sheet and dialog titles, coaching headlines, lesson headings, the blackjack decision title, the craps roll.
- **Title** (Inter 700, 15–17px): button labels, row titles, table top-bar titles, the coach note headline.
- **Body** (Inter 400, 14/20; small 13/18): explanations, sheet text, row details. Secondary copy uses Smoke.
- **Stat** (Inter 700, 16–24px): balances, counts and results. Numbers are always Inter Bold, never serif, except the session result's headline figures and the running count, which use Fraunces at 20–28px.
- **Label** (Inter 700, 10–12px, 0.5px tracking): stat labels, kickers and strip labels. Uppercase with 1px tracking only for the game card's summary line. Tab labels are Inter 500, 11px.

### Named Rules
**The Serif Names, Sans Works Rule.** Fraunces is used for titles and headline moments only, never for body text, buttons, labels or form input.

**The Scale Cap Rule.** Every text element sets `maxFontSizeMultiplier`: `textScale.display` (1.5×) for Fraunces, `textScale.body` (2×) for Inter. Layout reflows to accept the growth; type never shrinks to fit, except the tab bar label, which has a large-content viewer instead.

## Layout

A single scrolling column. `Screen` gives every page the After-Hours Green ground, safe-area insets plus a 24px side gutter, 16px gaps between blocks, and 32px bottom padding. The spacing scale is 4, 8, 12, 16, 24, 32, 48, 64; inner card padding is 16px, compact rows 12px.

Home is the exception: three full-bleed game cards stacked edge to edge with 2px seams, each filling its share of the height, and side by side when the window is wide. Tables are their own composition: a top bar, a phase stepper, a session strip, the felt, and the chip rack below.

Every screen supports portrait and landscape on phones and tablets. Controls reflow vertically at large text sizes and in narrow windows instead of shrinking. Sheets turn full screen once the font scale passes 1.5×. Touch targets are at least 48×48 (`MIN_TOUCH_TARGET`); chip slots are 56.

The persistent bottom tab bar is the only global navigation: one row at every text size, hidden on pre-account and locked screens and under sheets.

## Elevation & Depth

Tableside is flat. There are no shadows or elevation values anywhere in the app. Depth comes from tonal steps: background → card → popover, each slightly lighter green, with Felt Shadow and Deep Baize for inset or tinted pieces. Modals sit on a 70% black scrim. The only gradient fades a game card's photo into its scrim band so the text stays legible.

### Named Rules
**The Lamplight Rule.** A surface is raised by making it lighter, never by casting a shadow. Something that needs to come forward moves up one tonal step (card → popover) or gets a Control Edge border.

## Shapes

Soft, rounded rectangles: `sm` 6 for card backs and small marks, `md` 10 for fields, outline buttons, the segmented control and playing cards, `lg` 16 for cards, notices, panels, sheets' top corners and the chip rack, and `pill` for buttons, tags, tab pills, chips and icon buttons. `card` 20 is reserved and rarely used.

Borders are thin (1–1.5px) and functional. Focus is a 2px border swapped to Rail Brass or Linen inside a transparent 2px border that is always reserved, so focus never shifts layout. Game cards use a 3px inset ring.

## Components

### Buttons
Quiet, wide and pill-shaped.
- **Shape:** full pill, at least 48px tall, 24px horizontal padding, an optional 18px Lucide icon with an 8px gap.
- **Primary:** Rail Brass fill, Brass Shadow label in Inter Bold 16.
- **Secondary:** Felt Shadow fill, Linen label. **Ghost:** transparent, Linen label.
- **Outline:** the exception to the pill: 10px corners, 52px tall, 1px Control Edge border, 15px label. Used for list-like choices.
- **States:** pressed drops to 80% opacity; disabled 40%; keyboard focus turns the reserved 2px border Linen. No scale or bounce.

### Segmented control
- A Deep Baize trough with a Control Edge border, 10px corners and 4px padding. Each segment is at least 44px tall.
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
- Bottom sheet on Lamplit Panel with 16px top corners, a Control Edge grabber, a Fraunces 22px title and a 48px round close button on Felt Shadow. Slides up; becomes full screen at large text.

### Navigation
- **Tab bar:** Card Table with a hairline top border. Each tab has a 22px Lucide icon over an Inter Medium 11px label. Selected: the icon sits in a 56×30 Felt Shadow pill with a 1.5px Rail Brass outline, the icon turns brass and the label turns Linen Bold. Long-press or the system large-content viewer shows a big preview at large text sizes.
- **Table top bar:** Inter Bold 16 title, Smoke 12px subtitle, round 48px icon buttons. Below it, a phase stepper of 3px bars that fill with Rail Brass as the turn advances.

### Game card (signature)
Full-bleed photograph, a scrim band fading up from the bottom, an uppercase 11px summary line, a Fraunces 34px title in white, and a 44px Rail Brass circle with an arrow. This is the one place photography appears.

### Coach note (signature)
Marcus speaks on paper: a Coach Paper card with 16px corners and a 1px Coach Blue border, Ink text, a Coach Blue kicker, an Inter Bold 17 headline and Faded Ink detail. Its primary action inverts to Ink with Coach Paper text. A wrong answer is marked in Correction Red Ink with an icon. It is the only light surface on a dark screen, so coaching reads as a separate voice from the game.

### Table pieces
- **Chip rack:** Walnut Rail panel with 48px round chips in denomination colors; the selected chip gets a 2px Rail Brass ring and a check mark.
- **Playing cards:** Card Face with four-color suits; empty card spots are dashed Chalk outlines on the felt.
- **Bet spots:** Chalk boundary on felt; wagered spots get a 3px Card Face outline.
- **Status tag:** Felt Shadow pill with Inter Bold 12 Linen text.

## Do's and Don'ts

### Do:
- **Do** keep the ground After-Hours Green (#0E1311) and raise surfaces by tone: card, then popover.
- **Do** spend Rail Brass on one thing per view: the primary action, the selection, progress or focus.
- **Do** pair every status color with an icon, word or shape. Suits use four colors and their pips; selections get a check.
- **Do** add a new foreground/background pairing to `essentialPairs` before using it, and keep text at 4.5:1 and graphics at 3:1.
- **Do** reserve a transparent 2px border on every focusable control so the focus ring doesn't shift the layout.
- **Do** set `maxFontSizeMultiplier` on every `Text` and let layouts reflow at large sizes.
- **Do** keep numbers in Inter Bold and say them plainly. Practice, simulation and casino figures sit in visibly separate places.

### Don't:
- **Don't** drift toward generic fintech: no cold white or blue-gray cards, no stock chart styling, no white backgrounds outside the coach note and card faces.
- **Don't** build sportsbook dashboards: no dense tickers, no red/green money coloring across a screen, no urgency banners or countdowns.
- **Don't** add shadows or elevation; use the next tonal step.
- **Don't** use felt, rail, chip or pocket colors in app chrome.
- **Don't** set body text, buttons, labels or inputs in Fraunces.
- **Don't** use pure black or pure white on chrome; Pure White is only for text over photos and on chips and pockets.
- **Don't** add a light theme or ad-hoc hex values; new colors are named tokens in `tokens.ts`.
