# Tableside — confirmed planning inputs

_Planned under the working name "True Count" (the repository was renamed `tableside` on 2026-10-19). These are the original planning inputs; the MVP specs #51–#57 and their amendments supersede them where they differ._

These requirements were agreed during the initial planning conversation. Unsettled details belong in the decision tickets; this is not the finished MVP spec.

## Destination and audience

An implementation-ready MVP spec for iOS and Android, with the broader vision mapped into later releases. Recreational players are the primary audience; beginners are secondary.

## Games and learning

- Launch with blackjack, craps, and roulette, each with free play.
- Blackjack includes strategy coaching and card-counting practice.
- Craps and roulette each include five built-in practice strategies; their identities remain undecided.
- Counting challenges cover card-value recognition, running counts, true-count conversion, and counting during simulated table play.
- Challenges are short and replayable, rewarding accuracy before speed, with personal bests and optional timing.
- Guided practice pauses before a move deviates from the selected strategy, explains the prescribed action, and allows retry or explicit override.
- Strategy adherence is measured separately from winnings.

## Strategies and community

- An intuitive, flexible strategy builder supports conditions for placing bets, bet selection, amounts, outcome-based adjustments, and stopping conditions.
- Executable rules plus written descriptions support simulation, coaching, and later tutorials.
- Authenticated users with profiles can submit strategies for others to practice and rate.
- Popularity and performance are separate.
- Standardized automated simulation results, user practice results, and self-reported casino results are distinguished.
- Statistics include sample sizes, net results, win/loss/push rates, and maximum drawdown; exact definitions and other useful metrics remain open.

## Sessions

Track both simulated practice and manually entered casino sessions, with separate balances and performance histories. Bankrolls are tracking ledgers; the app does not hold funds or place real wagers.

## Authentication and access

- Initial sign-in requires internet; a previously signed-in account can reopen and play offline.
- Identity, subscription benefits, and locally available content are separate concerns.
- Free users have online access to all three games, with training limits still to decide.
- Free users select one offline game in Settings; changing that selection requires connectivity and prepares necessary content.
- Premium includes all three offline games, full training access, and no ads.
- Free accounts may receive ads at natural breaks online. Ads never interrupt a hand, roll, spin, or counting challenge; failure to load an ad does not prevent offline play.
- Session logging works offline on both plans; records sync on reconnection.
- Community browsing, publishing, and ratings require connectivity.
- Premium has a defined offline verification grace period, with its duration and expiration behavior still to decide.
- Saved sessions remain accessible after premium expires.
- Pricing, billing cadence, advertising format, and exact free training allowances are not settled.

## Inspiration supplied by the user

- https://www.youtube.com/@CasinoQuest
- https://www.youtube.com/@CEGDealerSchool
- https://www.youtube.com/@Blackjackapprenticeship

These references have not yet been reviewed. No specific rules or strategies have been attributed to them.

