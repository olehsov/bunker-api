import { Injectable, NotFoundException } from '@nestjs/common';
import { BunkerConfig, CataclysmConfig, PlayerTraits, TraitCard } from '../common/interfaces';
import { TraitCategory } from '../common/enums';
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

  generatePlayerTraits(): PlayerTraits {
    return {
      [TraitCategory.GENDER_AGE]: pickRandom(GENDER_AGE_POOL),
      [TraitCategory.BODY]: pickRandom(BODY_POOL),
      [TraitCategory.CHARACTER]: pickRandom(CHARACTER_POOL),
      [TraitCategory.PROFESSION]: pickNameWithLevel(PROFESSION_POOL, PROFESSION_LEVELS),
      [TraitCategory.HEALTH]: pickRandom(HEALTH_POOL),
      [TraitCategory.HOBBY]: pickNameWithLevel(HOBBY_POOL, HOBBY_LEVELS),
      [TraitCategory.PHOBIA]: pickRandom(PHOBIA_POOL),
      [TraitCategory.BAGGAGE]: pickRandom(BAGGAGE_POOL),
      [TraitCategory.FACT]: pickRandom(FACT_POOL),
    };
  }
}
