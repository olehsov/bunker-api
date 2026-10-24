export enum RoomPhase {
  LOBBY = 'LOBBY',
  READY_FOR_ROUND = 'READY_FOR_ROUND',
  REVEAL = 'REVEAL',
  AWAITING_VOTE_START = 'AWAITING_VOTE_START',
  VOTING = 'VOTING',
  AWAITING_NEXT_ROUND = 'AWAITING_NEXT_ROUND',
  FINISHED = 'FINISHED',
}

export enum TraitCategory {
  GENDER_AGE = 'GENDER_AGE',
  BODY = 'BODY',
  CHARACTER = 'CHARACTER',
  PROFESSION = 'PROFESSION',
  HEALTH = 'HEALTH',
  HOBBY = 'HOBBY',
  PHOBIA = 'PHOBIA',
  BAGGAGE = 'BAGGAGE',
  FACT = 'FACT',
}

export const TRAIT_CATEGORY_ORDER: TraitCategory[] = [
  TraitCategory.PROFESSION,
  TraitCategory.GENDER_AGE,
  TraitCategory.BODY,
  TraitCategory.CHARACTER,
  TraitCategory.HEALTH,
  TraitCategory.HOBBY,
  TraitCategory.PHOBIA,
  TraitCategory.BAGGAGE,
  TraitCategory.FACT,
];

export enum SpecialCardType {
  /** Swap one of your traits with the same category of another player. */
  SWAP_TRAIT = 'SWAP_TRAIT',
  /** Replace one of your own traits with a fresh random one. */
  REROLL_OWN = 'REROLL_OWN',
  /** Replace another player's trait with a fresh random one. */
  REROLL_TARGET = 'REROLL_TARGET',
  /** Set a player's (or your own) health to perfectly healthy. */
  HEAL = 'HEAL',
  /** Privately look at one random hidden trait of another player. */
  PEEK = 'PEEK',
  /** Force another player to publicly reveal one random hidden trait. */
  FORCE_REVEAL = 'FORCE_REVEAL',
  /** Votes against you don't count in the current voting session. */
  IMMUNITY = 'IMMUNITY',
  /** Your vote counts twice in the current voting session. */
  DOUBLE_VOTE = 'DOUBLE_VOTE',
  /** Clears all votes in the current voting session and restarts its timer. */
  REVOTE = 'REVOTE',
}

/** ANY: playable in every in-game phase; VOTING: only while a vote is open. */
export enum SpecialCardTiming {
  ANY = 'ANY',
  VOTING = 'VOTING',
}
