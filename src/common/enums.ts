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
