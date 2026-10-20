# Tableside

Tableside is a table-game practice and performance-tracking app for recreational players first and beginners second. Its launch games are blackjack, standard craps, and roulette. (It was planned under the working name "True Count"; **True count** below remains the blackjack term.)

## Language

### Tables and play

**Table conditions**:
The rules and betting constraints governing a simulated game, used to determine which actions and strategy guidance apply.

**Rule preset**:
A named starting configuration of table conditions that a player can customize within the supported choices.

**Bet selector**:
A named-wager interface for choosing a wager, its applicable numbers, and its stake, equivalent to selecting wagers on the graphical table. Both presentations operate the same practice session.
_Avoid_: bet list (as a term)

**Free play**:
Simulated table-game play without a required strategy to follow.

**Guided practice**:
Simulated play against a selected strategy, with corrections offered before a deviating move is executed. The player can retry or explicitly override the correction.

**Training turn**:
One blackjack round including its split hands, one craps roll, or one roulette spin. Multiple wagers and their individual outcomes remain within that turn.

**Wager outcome**:
The win, loss, or push of an individual resolved wager, determined by its net result after applicable commissions. It is distinct from the combined result of simultaneous wagers or an entire session.

**House edge**:
The long-run expected loss of a wager as a share of the amount bet, under the selected table conditions. It is a property of the rules, never of a strategy or a player.

**Pause**:
A learner's own deliberate pause of an activity.
_Avoid_: pause for holds the app imposes (see Suspension)

**Suspension**:
The app saving an activity in its committed phase and holding it, because of navigation, backgrounding, an account-gate change or uncertain access. A suspended activity resumes exactly where it was; suspension never settles, scores, or charges.
_Avoid_: pause

### Blackjack counting

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

### Strategies

**Strategy**:
A system prescribing a player's actions or bets under particular game conditions. A strategy is the reference for coaching and adherence measurement.

**Private strategy**:
A strategy a player created or customized for their own use. It is free, never public, and becomes a community strategy only through publication.

**Working copy**:
The editable, autosaved state of a private strategy, which may be incomplete or conflicting. Practice never follows a working copy, only a saved strategy revision.
_Avoid_: draft revision

**Strategy revision**:
A saved, immutable version of a strategy's instructions. A practice session follows one revision throughout, and its results retain that revision as their reference.

**Strategy source**:
The built-in strategy, template, community revision or private revision a strategy was customized from. It records lineage for attribution and comparison, not ownership.

**Declared table conditions**:
The table conditions a strategy states it is written for. An amount that fails its own declared conditions makes the strategy unable to run; incompatibility with a different table is checked when practice starts.

**Strategy diagnostic**:
A problem the builder reports in a working copy: incomplete, conflicting, incompatible with its declared table conditions, too large, or unbounded.

**Situation preview**:
An illustration of what a strategy prescribes in one chosen game situation, or over a short illustrative sequence. It records nothing and is never a result.

**Strategy cycle**:
A sequence of bets governed by a strategy's starting state and its completion or stopping rules. A cycle ends when those rules are met; starting another is explicit and never replenishes the session balance.

**Strategy adherence**:
How consistently a player follows the selected strategy, measured separately from financial results. Prescribed deviations and legal fallbacks count as adherent.

**Strategy override**:
A player's explicit choice to depart from the selected strategy's prescribed action or bet. It is distinct from following a playing deviation prescribed by that strategy.

**Legal fallback**:
An alternative prescribed action when the preferred action is unavailable under the current table conditions or available balance.

**Pending strategy action**:
A prescribed action or adjustment waiting to execute, distinct from a game outcome that has already settled. Holding the action does not reverse that outcome or its payout.

### Sessions and records

**Practice session**:
A period of simulated play at one game, explicitly started and explicitly ended by stopping, resetting, or switching games. It has its own performance history, simulated balance, and deviation log.

**Final settlement**:
The automatic resolution of outstanding wagers when a practice session ends, after legally removable wagers are returned. No new bets are placed during it.

**Practice funding**:
Simulated buy-ins and rebuys supplied to an ordinary practice session, rather than drawn from a shared spendable wallet. It is separate from the daily training bankroll and from casino-session balances.

**Rebuy**:
An additional buy-in recorded within a session before its final cash-out. A session's net result sums all its buy-ins, including rebuys, against the one final cash-out.

**Session drawdown**:
The fall from a session's previous balance peak, adjusted so rebuys do not reduce the drawdown and outstanding stakes retain their original value until resolution. Maximum session drawdown is the largest such fall during the session, including final settlement.

**Deviation event**:
A single point during a practice session where the player's actual action differed from the strategy's prescribed action, recording whether the player retried into the correct action or explicitly overrode it. Deviation events are never edited afterward; a session's deviation log is their ordered record, and an empty log means the session was flawless.

**Override-affected session**:
A practice session in which the player made at least one explicit strategy override. The marking persists across strategy-cycle restarts.

**Casino session**:
A manually recorded period of real casino play at one game, in the account's real currency. It records a game, a start time, one or more buy-ins and a cash-out; table conditions, end time and casino name are optional. It never carries a deviation log and is strictly private.

**Visit**:
An automatic grouping of two or more casino sessions that share the same casino name and local date. A visit has no identity, record, or fields of its own.

**Practice totals**:
Lifetime figures summarizing a player's completed practice sessions by game. They describe recorded sessions only and never predict results.

**Casino totals**:
Lifetime figures summarizing a player's recorded casino sessions by game and overall. They describe what was recorded only.

**Bankroll**:
A tracked balance allocated to play, rather than money held or wagered by Tableside. Simulated and real-play balances remain separate.

### Counting training and lessons

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

**Comparison group**:
The set of challenge attempts with identical settings, variant and assistance, within which personal bests and readiness are compared.

**Readiness streak**:
Consecutive qualifying unassisted Check attempts in one comparison group on one installation. Learn and assisted attempts leave it unchanged; a below-threshold, abandoned or insufficient-funds Check attempt breaks it.

**Readiness milestone**:
An earned indication that a learner met the counting-accuracy standard for a particular challenge configuration. It supports a next-step recommendation without restricting access to other challenges.

**Tutorial lesson**:
A replayable explanation of a game, strategy, counting skill, or app operation, optionally including a worked example. Completion records finishing the lesson, not assessed proficiency or a prerequisite for play.

**Worked example**:
A fixed demonstration with a bounded set of scripted interactions, freely replayable without consuming training allowance. Starting guided practice or a counting challenge from an example starts a separate training activity.

**Lesson bookmark**:
A learner's saved place within a tutorial lesson, shared across their devices.

**Material lesson change**:
An update to a tutorial lesson significant enough to restart its bookmark. Earlier completion stays in history as completion of an earlier version.

**Start here card**:
A dismissible Home card offering the optional tutorial lessons. Dismissing it never removes access to lessons.

**First-use hint**:
A short, dismissible explanation shown the first time a learner meets an unfamiliar control. It never gates play or reveals answers.

### Access and Tableside Premium

**Tableside Premium**:
The paid subscription tier giving unlimited training, all three launch games offline, no advertising, and publishing and rating of community strategies. An account "has Premium".
_Avoid_: Plus, premium account

**Training allowance**:
The daily amount of guided practice or counting challenges available to a free account. Guided-practice allowances may be measured by time, turns, or a training bankroll.

**Allowance policy**:
The assigned method and daily amounts governing a free account's guided practice and counting challenges. Different policies may be compared through training-allowance experiments.

**Policy notice**:
Advance notice to a player that their allowance policy will change at a coming daily reset.

**Allowance device**:
The installation designated to hold an account's free training allowance. Unused allowance can move to another installation after the original reconciles its usage.

**Allowance grant**:
A day's training allowance obtained online for an account's allowance device under its assigned allowance policy. Transferring unused allowance moves the remainder without replenishing that day's budget.

**Training bankroll**:
A daily simulated balance shared across games to limit guided practice under a bankroll-based allowance. It is separate from practice funding, casino balances and counting-challenge attempts.

**Metering basis**:
How an activity's training is counted against an allowance: by time, by training turns, by training bankroll, by challenge attempt, or not at all.

**Offline game selection**:
The one game every account chooses for free offline play. With Tableside Premium all three launch games are available offline, and the selection is the fallback if Premium ends.

**Offline deadline**:
The latest time an account can keep using Premium offline before it must reconnect for verification.

**Online authorization**:
Permission to play beyond an installation's cached offline rights, granted while usable internet is confirmed. It ends when internet becomes uncertain or the activity is suspended.

**Usable internet**:
A confirmed working connection to Tableside's own probe services. Radio indicators, operating-system reachability and captive portals never count.

**Unmatched historical purchase**:
A store purchase that is no longer linked to any usable Tableside account. It is recorded for billing support and never attached to a new account.

### Accounts and data

**Installation**:
One installation of the app on one device. Reinstalling creates a new installation.

**Account gate**:
The account's current access state on an installation (active, signed out, revoked, deletion scheduled, recovery needed, or age unresolved), which decides whether ordinary access is open.

**Age eligibility**:
An account's current established age band, or its unresolved or ineligible status, which governs access and protections. Only the current decision is kept.

**Deletion undo window**:
The 30 days after scheduling account deletion during which the player can cancel it. Access is locked and public content hidden, but nothing is destroyed.

**Conflict proposal**:
A competing edit to a private record made on another installation, preserved for the player to review instead of being silently lost.

**Conflict baseline**:
The accepted version of a record that remains in force, and is counted once in totals, while its conflict proposals await review.

**Recovery proposal**:
An edit to a deleted record made on another installation before it learned of the deletion. It is offered for restoration and never restored automatically.

**Local supplement**:
A labelled export of records on one installation that haven't reached the account yet.

**Rights request**:
A player's request to know, correct, delete or obtain their data, handled under the publisher's privacy obligations. It is distinct from self-service editing and deletion.

### Community

**Community strategy**:
A strategy revision published for others to practise, save, customize and rate. Its popularity and its standardized performance are distinct measures.

**Listing**:
The public page of a community strategy, showing its revisions, ratings, practice groups and standardized evidence.

**Community profile**:
A player's public identity for publishing and rating community strategies, including a display name. It is separate from their private sign-in information and is not required for private practice or casino-session tracking.

**Strategy rating**:
A player's assessment of a community strategy's practice usefulness and clarity, tied to the revision of their qualifying practice session. It is distinct from the strategy's financial performance.

**Strategy remix**:
A separately published strategy derived from another strategy revision, retaining attribution and a link to its source. It has its own ratings and performance evidence.

**Sharing period**:
A span during which an account has enabled sharing of eligible practice results. Disabling sharing invalidates that period; enabling it again starts a new period for future sessions.

**Sharing withdrawal**:
A player taking back their shared practice results from public results. Deleting a shared practice session withdraws all of that player's shared sessions for its revision.
_Avoid_: withdrawal (unqualified)

**Listing withdrawal**:
An author taking their community strategy's listing down. Others' saved copies keep working.
_Avoid_: withdrawal (unqualified), unpublish

**Republication**:
An author restoring a withdrawn listing.

**Practice group**:
Shared practice results for one strategy revision under the same table conditions and override status. It shows results only once enough distinct players contribute.

**Required removal**:
Removal of community content for a validated legal, privacy or minor-protection reason, distinct from moderation for content rules and from listing withdrawal.

**Strike**:
An upheld copyright removal counted against an account under the repeat-infringer policy.

**Test content**:
Community content from designated reviewer accounts, visible only to those accounts and never counted in public results.

### Standardized evidence

**Standardized simulation**:
An app-run evaluation of a strategy revision under defined comparison conditions. It supplies evidence for public performance comparisons, separate from community practice and self-reported casino results.

**Standardized evaluation**:
One authoritative standardized simulation and its evidence, shared by strategy revisions with identical normalized executable instructions and matching evaluation conditions. Reusing it preserves the original random allocation and does not supply additional independent evidence.

**Benchmark profile**:
A defined set of table conditions, starting bankroll, base betting unit, and session length used to compare strategy revisions through standardized simulation.

**Benchmark seat**:
A simulated blackjack player in a benchmark profile who plays ahead of the evaluated strategy with fixed minimum bets. It is outside every measured result.

**Comparison-eligible evidence**:
Standardized evidence complete and precise enough to be ranked against other strategies under the same benchmark profile.

### Feedback and presentation

**Event cue**:
An optional sound or haptic marking that something happened in play or a challenge, such as a card dealt, a wager settled, or an answer accepted, without judging the learner. It never carries information unavailable in the visible presentation.
_Avoid_: notification, alert

**Feedback cue**:
An optional sound or haptic carrying a judgment about the learner's answer or decision, such as correct, incorrect, or a correction offered. Check attempts withhold feedback cues until results, exactly as they withhold on-screen feedback.
_Avoid_: reward sound, success sound

**Casino atmosphere**:
Optional looping ambient sound played alongside table play, controlled separately from event and feedback cues. It never carries game information and never replaces a cue.
_Avoid_: background music, soundtrack

### Operations

**Provenance register**:
The record of where every shipped text, image, sound and persona asset came from and under what rights it is used.

**Data inventory**:
The record of every category of personal data Tableside handles, where it is processed, and how long it is kept.

**Operator notice**:
A message from the publisher to many accounts about the service itself, such as a beta shutdown.
