import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BunkerConfig,
  CataclysmConfig,
  PlayerTraits,
  SpecialCard,
  TraitCard,
} from '../common/interfaces';
import { SpecialCardTiming, TraitCategory } from '../common/enums';
import { SPECIAL_CARDS_PER_PLAYER } from '../game/constants/game.constants';
import { SPECIAL_CARD_TEMPLATES } from './special-cards.data';
import { BUNKERS } from './bunkers.data';
import { CATACLYSMS } from './cataclysms.data';
import {
  BAGGAGE_POOL,
  BODY_POOL,
  CHARACTER_POOL,
  FACT_POOL,
  GENDER_AGE_POOL,
  HEALTH_POOL,
  HOBBY_LEVELS,
  HOBBY_POOL,
  PHOBIA_POOL,
  PROFESSION_LEVELS,
  PROFESSION_POOL,
} from './traits.data';

function pickRandom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickNameWithLevel(names: string[], levels: string[]): TraitCard {
  return { label: pickRandom(names), detail: pickRandom(levels) };
}

@Injectable()
export class ConfigDataService {
  getBunkers(): BunkerConfig[] {
    return BUNKERS;
  }

  getCataclysms(): CataclysmConfig[] {
    return CATACLYSMS;
  }

  getBunkerById(id: string): BunkerConfig {
    const bunker = BUNKERS.find((b) => b.id === id);
    if (!bunker) {
      throw new NotFoundException(`Bunker "${id}" not found`);
    }
    return bunker;
  }

  getCataclysmById(id: string): CataclysmConfig {
    const cataclysm = CATACLYSMS.find((c) => c.id === id);
    if (!cataclysm) {
      throw new NotFoundException(`Cataclysm "${id}" not found`);
    }
    return cataclysm;
  }

  pickRandomBunkerId(): string {
    return pickRandom(BUNKERS).id;
  }

  pickRandomCataclysmId(): string {
    return pickRandom(CATACLYSMS).id;
  }

  generateTrait(category: TraitCategory): TraitCard {
    switch (category) {
      case TraitCategory.GENDER_AGE:
        return pickRandom(GENDER_AGE_POOL);
      case TraitCategory.BODY:
        return pickRandom(BODY_POOL);
      case TraitCategory.CHARACTER:
        return pickRandom(CHARACTER_POOL);
      case TraitCategory.PROFESSION:
        return pickNameWithLevel(PROFESSION_POOL, PROFESSION_LEVELS);
      case TraitCategory.HEALTH:
        return pickRandom(HEALTH_POOL);
      case TraitCategory.HOBBY:
        return pickNameWithLevel(HOBBY_POOL, HOBBY_LEVELS);
      case TraitCategory.PHOBIA:
        return pickRandom(PHOBIA_POOL);
      case TraitCategory.BAGGAGE:
        return pickRandom(BAGGAGE_POOL);
      case TraitCategory.FACT:
        return pickRandom(FACT_POOL);
    }
  }

  generatePlayerTraits(): PlayerTraits {
    return Object.fromEntries(
      Object.values(TraitCategory).map((category) => [category, this.generateTrait(category)]),
    ) as PlayerTraits;
  }

  /**
   * Deals distinct special cards; the first always has ANY timing so every
   * player can act outside voting too.
   */
  dealSpecialCards(playerId: string): SpecialCard[] {
    const anyTiming = SPECIAL_CARD_TEMPLATES.filter((t) => t.timing === SpecialCardTiming.ANY);
    const first = pickRandom(anyTiming);
    const rest = SPECIAL_CARD_TEMPLATES.filter((t) => t !== first)
      .sort(() => Math.random() - 0.5)
      .slice(0, SPECIAL_CARDS_PER_PLAYER - 1);
    return [first, ...rest].map((template, i) => ({
      ...template,
      id: `${playerId}:${i}`,
      used: false,
      targetPlayerId: null,
    }));
  }
}
