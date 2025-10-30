export type SpecialCardInfo = {
  name: string; // short name like Boot
  short: string; // display like 'Boot (Ace)'
  description: string; // explanatory text
};

export const SPECIAL_CARDS: Record<string, SpecialCardInfo> = {
  A: { name: 'Boot', short: 'Boot (Ace)', description: 'Draw 2 cards when played' },
  K: { name: 'Firewall', short: 'Firewall (King)', description: 'Grants an extra turn' },
  Q: { name: 'Decrypt', short: 'Decrypt (Queen)', description: 'Peek and reorder the top three cards of the deck' },
  J: { name: 'Hack', short: 'Hack (Jack)', description: 'Steal two random cards from your opponent' },
  JOKER: { name: 'Glitch', short: 'Glitch (Joker)', description: 'Wildcard in sequences or delete an opponent sequence' },
};

// Preferred order for display in the help panel
export const SPECIAL_ORDER = ['A', 'K', 'Q', 'J', 'JOKER'];

export const getSpecialInfo = (rank?: string) => {
  if (!rank) return undefined;
  const key = rank.toUpperCase();
  return SPECIAL_CARDS[key];
};
