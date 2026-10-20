export type GameId = 'blackjack' | 'craps' | 'roulette';

export interface LaunchGame {
  id: GameId;
  title: string;
  /** Short rules summary shown above the title. */
  summary: string;
  /** The summary as a screen reader should speak it. */
  spokenSummary: string;
  /** A bundled image (the result of `require`). */
  image: number;
}

/** The three launch games, in Home order. */
export const LAUNCH_GAMES: readonly LaunchGame[] = [
  {
    id: 'blackjack',
    title: 'Blackjack',
    summary: '6 decks · 3:2 · Basic & Hi-Lo coaching',
    spokenSummary: '6 decks, blackjack pays 3 to 2, basic strategy and Hi-Lo coaching',
    image: require('../assets/games/blackjack.jpg'),
  },
  {
    id: 'craps',
    title: 'Craps',
    summary: 'Standard craps · 5 built-in strategies',
    spokenSummary: 'Standard craps, 5 built-in strategies',
    image: require('../assets/games/craps.jpg'),
  },
  {
    id: 'roulette',
    title: 'Roulette',
    summary: 'Single or double zero · 5 strategies',
    spokenSummary: 'Single or double zero, 5 strategies',
    image: require('../assets/games/roulette.jpg'),
  },
];

export const findGame = (id: unknown) => LAUNCH_GAMES.find((game) => game.id === id);
