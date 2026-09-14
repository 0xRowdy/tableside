# True Count

True Count is a table-game practice and performance-tracking app for recreational players first and beginners second. Its games include blackjack, craps, and roulette.

## Language

**Table conditions**:
The rules and betting constraints governing a simulated game, used to determine which actions and strategy guidance apply.

**Rule preset**:
A named starting configuration of table conditions that a player can customize within the supported choices.

**Bet selector**:
A named-wager interface for choosing a wager, its applicable numbers, and its stake, equivalent to selecting wagers on the graphical table. Both presentations operate the same practice session.

**Strategy**:
A system prescribing a player's actions or bets under particular game conditions. A strategy is the reference for coaching and adherence measurement.

**Guided practice**:
Simulated play against a selected strategy, with corrections offered before a deviating move is executed. The player can retry or explicitly override the correction.

**Tutorial lesson**:
A replayable explanation of a game, strategy, counting skill, or app operation, optionally including a worked example. Completion records finishing the lesson, not assessed proficiency or a prerequisite for play.

**Worked example**:
A fixed demonstration with a bounded set of scripted interactions, freely replayable without consuming training allowance. Starting guided practice or a counting challenge from an example starts a separate training activity.

**Blackjack training mode**:
A combination of the playing decisions being practiced and responsibility for maintaining the count. Basic and deviation practice can use app-supplied conditions, while counting modes require the player to maintain the count.

**Playing deviation**:
A prescribed departure from blackjack basic strategy when a specified condition is met. Following a selected deviation is strategy adherence, distinct from a player overriding coaching.

**Counting system**:
The card values and count calculations used to summarize exposed cards for blackjack practice. A counting system is distinct from the playing decisions or bet amounts selected using its count.

**Bet schedule**:
A rule mapping a blackjack count to a prescribed wager amount. Following the schedule is assessed separately from maintaining the count and choosing playing actions.

**Running count**:
The accumulated counting-system values of cards exposed during the current blackjack shoe. Concealed cards do not contribute until revealed.

**True count**:
The running count adjusted for the estimated decks remaining in the shoe using the selected conversion convention. It supplies conditions for playing deviations and bet schedules.

**Shoe penetration**:
The portion of a blackjack shoe dealt before the shuffle point is reached. A round already in progress finishes before the shuffle.

**Strategy cycle**:
A sequence of bets governed by a strategy's starting state and completion or termination rules. Restarting a cycle resets its strategy state without replenishing the session balance.

**Free play**:
Simulated table-game play without a required strategy to follow.

**Strategy adherence**:
How consistently a player follows the selected strategy, measured separately from financial results.

**Strategy override**:
A player's explicit choice to depart from the selected strategy's prescribed action or bet. It is distinct from following a playing deviation prescribed by that strategy.

**Strategy revision**:
A saved version of a strategy's instructions. A practice session follows one revision throughout, and its results retain that revision as their reference.

**Legal fallback**:
An alternative prescribed action when the preferred action is unavailable under the current table conditions or available balance.

**Pending strategy action**:
A prescribed action or adjustment waiting to execute, distinct from a game outcome that has already settled. Pausing the action does not reverse that outcome or its payout.

**Final settlement**:
The resolution of outstanding wagers after a strategy stops adding bets, with legally removable wagers returned.

**Practice session**:
A period of simulated play at one game, explicitly started and explicitly ended by stopping, resetting, or switching games. It has its own performance history, simulated balance, and deviation log.

**Casino session**:
A manually recorded period of real casino play at one game, bounded the same way as a practice session. It records a game, a date, one or more buy-ins, and a cash-out; table conditions and casino name are optional. It never carries a deviation log, since self-reported play cannot be verified against a strategy. Casino sessions are strictly private and never eligible for community or standardized-comparison features.

**Rebuy**:
An additional buy-in recorded within a session before its final cash-out. A session's net result sums all its buy-ins, including rebuys, against the one final cash-out.

**Practice funding**:
Simulated buy-ins and rebuys supplied to an ordinary practice session, rather than drawn from a shared spendable wallet. It is separate from the daily training bankroll and from casino-session balances.

**Visit**:
An automatic grouping of casino sessions that share the same casino name and date, used only to present a rolled-up view of a night's play. A visit has no identity, record, or fields of its own beyond that shared casino name and date.

**Deviation event**:
A single point during a practice session where the player's actual action differed from the strategy's prescribed action, recording whether the player retried into the correct action or explicitly overrode it (see Strategy override). Deviation events are logged individually as they occur and are never edited afterward. A session's deviation log is the ordered record of its deviation events; an empty log means the session was flawless.

**Bankroll**:
A tracked balance allocated to play, rather than money held or wagered by True Count. Simulated and real-play balances remain separate.

**Community strategy**:
A strategy submitted by an authenticated user with a profile for others to practice and rate. Its popularity and reported performance are distinct measures.

**Community profile**:
A player's public identity for publishing and rating community strategies, including a display name. It is separate from their private sign-in information and is not required for private practice or casino-session tracking.

**Sharing period**:
A span during which an account has enabled sharing of eligible practice results. Disabling sharing invalidates that period; enabling it again starts a new period for future sessions.

**Standardized simulation**:
An app-run evaluation of a strategy revision under defined comparison conditions. It supplies evidence for public performance comparisons, separate from community practice and self-reported casino results.

**Standardized evaluation**:
One authoritative standardized simulation and its evidence, shared by strategy revisions with identical normalized executable instructions and matching evaluation conditions. Reusing it preserves the original random allocation and does not supply additional independent evidence.

**Benchmark profile**:
A defined set of table conditions, starting bankroll, base betting unit, and session length used to compare strategy revisions through standardized simulation.

**Session drawdown**:
The fall from a session's previous balance peak, adjusted so rebuys do not reduce the drawdown and outstanding stakes retain their original value until resolution. Maximum session drawdown is the largest such fall during the session, including final settlement.

**Strategy rating**:
A player's assessment of a community strategy's practice usefulness and clarity, tied to the revision they practiced. It is distinct from the strategy's financial performance.

**Strategy remix**:
A separately published strategy derived from another strategy revision, retaining attribution and a link to its source. It has its own ratings and performance evidence.

**Wager outcome**:
The win, loss, or push of an individual resolved wager, determined by its net result after applicable commissions. It is distinct from the combined result of simultaneous wagers or an entire session.

**Offline game selection**:
The account's selected game for free offline play, retained as a fallback while premium provides all three launch games offline.

**Premium account**:
A subscription tier with full training access, all three launch games available offline, and no advertising.

**Counting challenge**:
A short, replayable exercise in card-value recognition, running counts, true-count conversion, or counting during simulated table play. Progress rewards accuracy before speed.

**Challenge attempt**:
One run of a counting challenge from its first exercise content through completion or an early ending, including abandonment or insufficient funds. Resuming preserves the attempt; restarting with fresh randomized content creates another.

**Learn variant**:
A counting challenge that provides immediate explanations and retries. Its accuracy preserves the learner's first answer even after correction.

**Check variant**:
A counting challenge that withholds correctness feedback until the end, except for a reference count the learner explicitly chooses to reveal. Its results are kept separate from Learn results.

**Assisted attempt**:
A challenge attempt that provides learning aids revealing the answer, including a Check attempt in which the learner shows the reference running count. Hiding the aid again does not restore unassisted status.

**Observe table challenge**:
A counting challenge in which simulated players make the playing and betting decisions while the learner maintains the count.

**Play table challenge**:
A counting challenge in which the learner also makes playing decisions, with optional bet-schedule practice.

**Challenge balance**:
The finite simulated funds available to the learner during one Play table-challenge attempt. It is separate from ordinary practice funding and daily training allowances.

**Count checkpoint**:
A point in a counting challenge at which the learner submits a running count, true count, or both for assessment.

**Readiness milestone**:
An earned indication that a learner met the counting-accuracy standard for a particular challenge configuration. It supports a next-step recommendation without restricting access to other challenges.

**Training allowance**:
The daily amount of guided practice or counting challenges available to a free account. Guided-practice allowances may be measured by time, turns, or a training bankroll.

**Allowance policy**:
The assigned method and daily amounts governing a free account's guided practice and counting challenges. Different policies may be compared through training-allowance experiments.

**Allowance device**:
The device designated to hold an account's free training allowance. Unused allowance can move to another device after the original device reconciles its usage.

**Allowance grant**:
A day's training allowance obtained online for an account's designated allowance device under its assigned allowance policy. Transferring unused allowance moves the remainder without replenishing that day's budget.

**Training turn**:
One blackjack round including its split hands, one craps roll, or one roulette spin, used to measure guided-practice allowance. Multiple wagers and their individual outcomes remain within that turn.

**Training bankroll**:
A daily simulated balance shared across games to limit guided practice under a bankroll-based allowance. It is separate from saved practice and casino balances and from counting-challenge attempts.

**Event cue**:
An optional sound or haptic marking that something happened in play or a challenge, such as a card dealt, a wager settled, or an answer accepted, without judging the learner. It never carries information unavailable in the visible presentation.
_Avoid_: notification, alert

**Feedback cue**:
An optional sound or haptic carrying a judgment about the learner's answer or decision, such as correct, incorrect, or a correction offered. Check attempts withhold feedback cues until results, exactly as they withhold on-screen feedback.
_Avoid_: reward sound, success sound

**Casino atmosphere**:
Optional looping ambient sound played alongside table play, controlled separately from event and feedback cues. It never carries game information and never replaces a cue.
_Avoid_: background music, soundtrack
