import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Player, Room, SpecialCard } from '../common/interfaces';
import {
  RoomPhase,
  SpecialCardTiming,
  SpecialCardType,
  TraitCategory,
  TRAIT_CATEGORY_ORDER,
} from '../common/enums';
import { RoomsService } from '../rooms/rooms.service';
import { ConfigDataService } from '../config/config-data.service';
import { PERFECT_HEALTH } from '../config/special-cards.data';
import { VOTING_DISCUSSION_SECONDS } from './constants/game.constants';
import { addLog } from './game-log.util';

/** Phases in which ANY-timing cards may be played: the whole game except lobby and the final screen. */
const IN_GAME_PHASES: RoomPhase[] = [
  RoomPhase.READY_FOR_ROUND,
  RoomPhase.REVEAL,
  RoomPhase.AWAITING_VOTE_START,
  RoomPhase.VOTING,
  RoomPhase.AWAITING_NEXT_ROUND,
];

const CATEGORY_ACCUSATIVE: Record<TraitCategory, string> = {
  [TraitCategory.GENDER_AGE]: 'стать і вік',
  [TraitCategory.BODY]: 'статуру',
  [TraitCategory.CHARACTER]: 'характер',
  [TraitCategory.PROFESSION]: 'професію',
  [TraitCategory.HEALTH]: "здоров'я",
  [TraitCategory.HOBBY]: 'хобі',
  [TraitCategory.PHOBIA]: 'фобію',
  [TraitCategory.BAGGAGE]: 'багаж',
  [TraitCategory.FACT]: 'факт',
};

const CATEGORY_LABEL: Record<TraitCategory, string> = {
  [TraitCategory.GENDER_AGE]: 'Стать та вік',
  [TraitCategory.BODY]: 'Статура',
  [TraitCategory.CHARACTER]: 'Характер',
  [TraitCategory.PROFESSION]: 'Професія',
  [TraitCategory.HEALTH]: "Здоров'я",
  [TraitCategory.HOBBY]: 'Хобі',
  [TraitCategory.PHOBIA]: 'Фобія',
  [TraitCategory.BAGGAGE]: 'Багаж',
  [TraitCategory.FACT]: 'Факт',
};

const CATEGORY_INSTRUMENTAL: Record<TraitCategory, string> = {
  [TraitCategory.GENDER_AGE]: 'статтю і віком',
  [TraitCategory.BODY]: 'статурою',
  [TraitCategory.CHARACTER]: 'характером',
  [TraitCategory.PROFESSION]: 'професіями',
  [TraitCategory.HEALTH]: "здоров'ям",
  [TraitCategory.HOBBY]: 'хобі',
  [TraitCategory.PHOBIA]: 'фобіями',
  [TraitCategory.BAGGAGE]: 'багажем',
  [TraitCategory.FACT]: 'фактами',
};

// Player names aren't declined, so log lines keep them in the nominative
// ("гравця Аня") rather than guessing case endings.
@Injectable()
export class SpecialCardsService {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly configDataService: ConfigDataService,
  ) {}

  playCard(code: string, playerId: string, cardId: string, targetPlayerId?: string | null): Room {
    const room = this.roomsService.getRoomOrThrow(code);
    const player = this.roomsService.getPlayerOrThrow(room, playerId);

    if (!IN_GAME_PHASES.includes(room.phase)) {
      throw new BadRequestException('Особливі умови можна грати лише під час гри');
    }
    if (player.eliminated) {
      throw new ForbiddenException('Вигнані гравці не можуть грати особливі умови');
    }
    const card = player.specialCards.find((c) => c.id === cardId);
    if (!card) {
      throw new BadRequestException('Такої картки особливих умов у вас немає');
    }
    if (card.used) {
      throw new BadRequestException('Цю картку вже зіграно');
    }
    if (card.timing === SpecialCardTiming.VOTING) {
      if (room.phase !== RoomPhase.VOTING || !room.votingSession) {
        throw new BadRequestException('Цю картку можна зіграти лише під час голосування');
      }
      if (room.votingSession.lastResult === 'TIE') {
        throw new BadRequestException('Спершу перезапустіть голосування після нічиєї');
      }
    }

    const target = this.resolveTarget(room, player, card, targetPlayerId ?? null);
    const description = this.applyEffect(room, player, card, target);

    card.used = true;
    card.targetPlayerId = target?.id ?? null;
    addLog(room, 'card', `${player.name} грає «${card.title}»${description}`);
    return room;
  }

  private resolveTarget(
    room: Room,
    player: Player,
    card: SpecialCard,
    targetPlayerId: string | null,
  ): Player | null {
    if (card.target === 'none') {
      return null;
    }
    if (!targetPlayerId) {
      throw new BadRequestException('Оберіть гравця для цієї картки');
    }
    const target = this.roomsService.getPlayerOrThrow(room, targetPlayerId);
    if (target.eliminated) {
      throw new BadRequestException('Не можна обрати вигнаного гравця');
    }
    if (card.target === 'other' && target.id === player.id) {
      throw new BadRequestException('Цю картку треба зіграти на іншого гравця');
    }
    return target;
  }

  /** Applies the card and returns the tail of the public log line. */
  private applyEffect(
    room: Room,
    player: Player,
    card: SpecialCard,
    target: Player | null,
  ): string {
    switch (card.type) {
      case SpecialCardType.SWAP_TRAIT: {
        const category = this.requireCategory(card);
        const mine = this.traitsOf(player);
        const theirs = this.traitsOf(target!);
        [mine[category], theirs[category]] = [theirs[category], mine[category]];
        return ` — ${player.name} і ${target!.name} міняються ${CATEGORY_INSTRUMENTAL[category]}`;
      }
      case SpecialCardType.REROLL_OWN: {
        const category = this.requireCategory(card);
        this.traitsOf(player)[category] = this.freshTrait(
          category,
          this.traitsOf(player)[category].label,
        );
        return ` і отримує нову картку «${CATEGORY_LABEL[category]}»`;
      }
      case SpecialCardType.REROLL_TARGET: {
        const category = this.requireCategory(card);
        const traits = this.traitsOf(target!);
        traits[category] = this.freshTrait(category, traits[category].label);
        return ` проти гравця ${target!.name}`;
      }
      case SpecialCardType.HEAL: {
        this.traitsOf(target!)[TraitCategory.HEALTH] = { ...PERFECT_HEALTH };
        return target!.id === player.id ? ' на себе' : ` на гравця ${target!.name}`;
      }
      case SpecialCardType.PEEK: {
        const hidden = this.hiddenFor(player, target!);
        if (hidden.length === 0) {
          throw new BadRequestException(`У гравця ${target!.name} немає прихованих характеристик`);
        }
        const category = hidden[Math.floor(Math.random() * hidden.length)];
        player.peeks.push({ targetId: target!.id, category });
        return ` і таємно дивиться характеристику гравця ${target!.name}`;
      }
      case SpecialCardType.FORCE_REVEAL: {
        const hidden = TRAIT_CATEGORY_ORDER.filter((c) => !target!.revealedTraitKeys.includes(c));
        if (hidden.length === 0) {
          throw new BadRequestException(`У гравця ${target!.name} вже все відкрито`);
        }
        const category = hidden[Math.floor(Math.random() * hidden.length)];
        target!.revealedTraitKeys.push(category);
        return ` — гравець ${target!.name} відкриває ${CATEGORY_ACCUSATIVE[category]}`;
      }
      case SpecialCardType.IMMUNITY: {
        const session = room.votingSession!;
        const remaining = room.players.filter(
          (p) => !p.eliminated && p.id !== player.id && !session.immunePlayerIds.includes(p.id),
        );
        // Voting needs at least two candidates left, otherwise someone has nobody to vote for.
        if (remaining.length < 2) {
          throw new BadRequestException(
            'Імунітет зараз не можна зіграти — залишиться замало кандидатів',
          );
        }
        session.immunePlayerIds.push(player.id);
        for (const [voterId, votedFor] of Object.entries(session.votes)) {
          if (votedFor === player.id) {
            delete session.votes[voterId];
          }
        }
        return ' — за нього в цьому голосуванні не голосують';
      }
      case SpecialCardType.DOUBLE_VOTE: {
        room.votingSession!.doubleVoterIds.push(player.id);
        return ' — його голос рахується двічі';
      }
      case SpecialCardType.REVOTE: {
        room.votingSession!.votes = {};
        room.phaseDeadline = Date.now() + VOTING_DISCUSSION_SECONDS * 1000;
        return ' — усі голоси скасовано';
      }
    }
  }

  private requireCategory(card: SpecialCard): TraitCategory {
    if (!card.category) {
      throw new BadRequestException('Картка без категорії');
    }
    return card.category;
  }

  private traitsOf(player: Player) {
    if (!player.traits) {
      throw new BadRequestException('Гра ще не розпочалась');
    }
    return player.traits;
  }

  /** New random trait, retrying a few times so the card visibly changes something. */
  private freshTrait(category: TraitCategory, currentLabel: string) {
    let next = this.configDataService.generateTrait(category);
    for (let i = 0; i < 5 && next.label === currentLabel; i++) {
      next = this.configDataService.generateTrait(category);
    }
    return next;
  }

  /** Target's categories that are neither public nor already peeked by `viewer`. */
  private hiddenFor(viewer: Player, target: Player): TraitCategory[] {
    return TRAIT_CATEGORY_ORDER.filter(
      (c) =>
        !target.revealedTraitKeys.includes(c) &&
        !viewer.peeks.some((p) => p.targetId === target.id && p.category === c),
    );
  }
}
