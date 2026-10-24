import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Player, Room, VotingSession } from '../common/interfaces';
import { RoomPhase, TraitCategory, TRAIT_CATEGORY_ORDER } from '../common/enums';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  REVEAL_TURN_SECONDS,
  TOTAL_ROUNDS,
  VOTING_DISCUSSION_SECONDS,
  votingSessionsForRound,
} from './constants/game.constants';
import { RoomsService } from '../rooms/rooms.service';
import { ConfigDataService } from '../config/config-data.service';
import { addLog, tallyVotes } from './game-log.util';

function sortedByJoinOrder(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.joinOrder - b.joinOrder);
}

function activePlayers(room: Room): Player[] {
  return sortedByJoinOrder(room.players.filter((p) => !p.eliminated));
}

@Injectable()
export class GameService {
  constructor(
    private readonly roomsService: RoomsService,
    private readonly configDataService: ConfigDataService,
  ) {}

  /** Next non-eliminated player after `playerId`, walking the fixed join-order circle. */
  private nextActivePlayerAfter(room: Room, playerId: string): string {
    const all = sortedByJoinOrder(room.players);
    const startIndex = all.findIndex((p) => p.id === playerId);
    for (let step = 1; step <= all.length; step++) {
      const candidate = all[(startIndex + step) % all.length];
      if (!candidate.eliminated) {
        return candidate.id;
      }
    }
    throw new BadRequestException('Немає активних гравців для передачі ходу');
  }

  startGame(code: string, playerId: string): Room {
    const room = this.roomsService.getRoomOrThrow(code);
    this.roomsService.assertOwner(room, playerId);

    if (room.phase !== RoomPhase.LOBBY) {
      throw new BadRequestException('Гру вже розпочато');
    }
    if (room.players.length < MIN_PLAYERS || room.players.length > MAX_PLAYERS) {
      throw new BadRequestException(`Потрібно від ${MIN_PLAYERS} до ${MAX_PLAYERS} гравців`);
    }
    const notReady = room.players.filter((p) => !p.isOwner && !p.ready);
    if (notReady.length > 0) {
      throw new BadRequestException('Не всі гравці готові');
    }

    if (!room.bunkerLocked) {
      room.bunkerId = this.configDataService.pickRandomBunkerId();
    }
    if (!room.cataclysmLocked) {
      room.cataclysmId = this.configDataService.pickRandomCataclysmId();
    }

    for (const player of room.players) {
      player.traits = this.configDataService.generatePlayerTraits();
      player.revealedTraitKeys = [];
      player.specialCards = this.configDataService.dealSpecialCards(player.id);
      player.peeks = [];
    }
    room.log = [];

    room.initialPlayerCount = room.players.length;
    room.round = 0;
    room.phase = RoomPhase.READY_FOR_ROUND;
    return room;
  }

  startRound(code: string, playerId: string): Room {
    const room = this.roomsService.getRoomOrThrow(code);
    this.roomsService.assertOwner(room, playerId);

    if (room.phase !== RoomPhase.READY_FOR_ROUND && room.phase !== RoomPhase.AWAITING_NEXT_ROUND) {
      throw new BadRequestException('Зараз не можна розпочати раунд');
    }
    if (room.round >= TOTAL_ROUNDS) {
      throw new BadRequestException('Усі раунди вже зіграно');
    }

    room.round += 1;

    let startPlayerId: string;
    if (room.round === 1) {
      startPlayerId = room.ownerId;
    } else {
      // currentRoundMoveOrder still holds the just-finished round's move order at
      // this point (it's only cleared below) — that's the "previous round" we need.
      const secondMover = room.currentRoundMoveOrder[1];
      const secondMoverPlayer = room.players.find((p) => p.id === secondMover);
      startPlayerId =
        secondMoverPlayer && !secondMoverPlayer.eliminated
          ? secondMoverPlayer.id
          : this.nextActivePlayerAfter(room, secondMover);
    }

    room.previousRoundMoveOrder = room.currentRoundMoveOrder;
    room.currentRoundMoveOrder = [];
    room.activePlayerId = startPlayerId;
    room.votingSession = null;
    room.phase = RoomPhase.REVEAL;
    room.phaseDeadline = Date.now() + REVEAL_TURN_SECONDS * 1000;
    addLog(room, 'round', `Раунд ${room.round} розпочато`);
    return room;
  }

  revealTrait(code: string, playerId: string, category: TraitCategory): Room {
    const room = this.roomsService.getRoomOrThrow(code);

    if (room.phase !== RoomPhase.REVEAL) {
      throw new BadRequestException('Зараз не фаза відкриття властивостей');
    }
    if (room.activePlayerId !== playerId) {
      throw new ForbiddenException('Зараз не ваш хід');
    }
    const player = this.roomsService.getPlayerOrThrow(room, playerId);

    const forceProfession = this.mustRevealProfession(room, player);
    const effectiveCategory = forceProfession ? TraitCategory.PROFESSION : category;
    if (!TRAIT_CATEGORY_ORDER.includes(effectiveCategory)) {
      throw new BadRequestException('Невідома категорія властивості');
    }
    if (forceProfession && category && category !== TraitCategory.PROFESSION) {
      throw new BadRequestException('У 1-му раунді всі відкривають картку Професії');
    }
    if (player.revealedTraitKeys.includes(effectiveCategory)) {
      throw new BadRequestException('Цю властивість вже відкрито');
    }

    return this.applyRevealAndAdvance(room, player, effectiveCategory);
  }

  /**
   * Called by the gateway when a REVEAL turn's deadline elapses before the
   * active player acts: picks a random not-yet-revealed category on their
   * behalf and advances the turn exactly as a manual reveal would.
   */
  autoRevealTimeout(code: string): Room {
    const room = this.roomsService.getRoomOrThrow(code);

    if (room.phase !== RoomPhase.REVEAL || !room.activePlayerId) {
      return room;
    }
    const player = this.roomsService.getPlayerOrThrow(room, room.activePlayerId);

    const unrevealed = TRAIT_CATEGORY_ORDER.filter((c) => !player.revealedTraitKeys.includes(c));
    if (unrevealed.length === 0) {
      return room;
    }
    const category = this.mustRevealProfession(room, player)
      ? TraitCategory.PROFESSION
      : unrevealed[Math.floor(Math.random() * unrevealed.length)];

    return this.applyRevealAndAdvance(room, player, category);
  }

  /**
   * Round 1 opens professions — unless a FORCE_REVEAL card already exposed
   * this player's profession, in which case any hidden card is fair game.
   */
  private mustRevealProfession(room: Room, player: Player): boolean {
    return room.round === 1 && !player.revealedTraitKeys.includes(TraitCategory.PROFESSION);
  }

  /** Shared by manual and auto-timeout reveals: records the trait and moves the turn on. */
  private applyRevealAndAdvance(room: Room, player: Player, category: TraitCategory): Room {
    player.revealedTraitKeys.push(category);
    room.currentRoundMoveOrder.push(player.id);

    const active = activePlayers(room);
    const everyoneMoved = room.currentRoundMoveOrder.length >= active.length;

    if (!everyoneMoved) {
      room.activePlayerId = this.nextActivePlayerAfter(room, player.id);
      room.phaseDeadline = Date.now() + REVEAL_TURN_SECONDS * 1000;
      return room;
    }

    room.activePlayerId = null;
    room.phaseDeadline = null;
    const sessions = votingSessionsForRound(room.initialPlayerCount, room.round);
    room.votingSessionsRemainingThisRound = sessions;

    if (sessions === 0) {
      this.advanceAfterRoundResolved(room);
    } else {
      room.phase = RoomPhase.AWAITING_VOTE_START;
    }
    return room;
  }

  startVoting(code: string, playerId: string): Room {
    const room = this.roomsService.getRoomOrThrow(code);
    this.roomsService.assertOwner(room, playerId);

    if (room.phase !== RoomPhase.AWAITING_VOTE_START) {
      throw new BadRequestException('Зараз не можна розпочати голосування');
    }
    room.votingSession = this.freshVotingSession(0);
    room.phase = RoomPhase.VOTING;
    room.phaseDeadline = Date.now() + VOTING_DISCUSSION_SECONDS * 1000;
    return room;
  }

  castVote(code: string, playerId: string, targetPlayerId: string): Room {
    const room = this.roomsService.getRoomOrThrow(code);

    if (room.phase !== RoomPhase.VOTING || !room.votingSession) {
      throw new BadRequestException('Зараз не фаза голосування');
    }
    const voter = this.roomsService.getPlayerOrThrow(room, playerId);
    if (voter.eliminated) {
      throw new ForbiddenException('Вигнані гравці не голосують');
    }
    if (playerId === targetPlayerId) {
      throw new BadRequestException('Не можна голосувати за самого себе');
    }
    const target = this.roomsService.getPlayerOrThrow(room, targetPlayerId);
    if (target.eliminated) {
      throw new BadRequestException('Не можна голосувати за вигнаного гравця');
    }
    if (room.votingSession.immunePlayerIds.includes(targetPlayerId)) {
      throw new BadRequestException('У цього гравця імунітет у поточному голосуванні');
    }

    room.votingSession.votes[playerId] = targetPlayerId;
    return room;
  }

  /**
   * Called by the gateway when a VOTING session's deadline elapses: every
   * active player who hasn't voted gets a vote for a random valid target, so
   * the owner can close the session instead of waiting on idle players.
   */
  autoVoteTimeout(code: string): Room {
    const room = this.roomsService.getRoomOrThrow(code);
    const session = room.votingSession;
    if (room.phase !== RoomPhase.VOTING || !session) {
      return room;
    }
    // Cleared even after a TIE so the gateway doesn't re-arm an expired deadline.
    room.phaseDeadline = null;
    if (session.lastResult !== null) {
      return room;
    }

    const active = activePlayers(room);
    const idle = active.filter((p) => session.votes[p.id] === undefined);
    for (const voter of idle) {
      const targets = active.filter(
        (p) => p.id !== voter.id && !session.immunePlayerIds.includes(p.id),
      );
      if (targets.length > 0) {
        session.votes[voter.id] = targets[Math.floor(Math.random() * targets.length)].id;
      }
    }
    if (idle.length > 0) {
      addLog(room, 'vote', `Час вийшов: ${idle.map((p) => p.name).join(', ')} — голос випадковий`);
    }
    return room;
  }

  endVoting(code: string, playerId: string): Room {
    const room = this.roomsService.getRoomOrThrow(code);
    this.roomsService.assertOwner(room, playerId);

    if (room.phase !== RoomPhase.VOTING || !room.votingSession) {
      throw new BadRequestException('Зараз не фаза голосування');
    }
    const active = activePlayers(room);
    const votes = room.votingSession.votes;
    const allVoted = active.every((p) => votes[p.id] !== undefined);
    if (!allVoted) {
      throw new BadRequestException('Не всі гравці проголосували');
    }

    const counts = Object.entries(tallyVotes(room.votingSession));
    const maxVotes = Math.max(...counts.map(([, c]) => c));
    const topVoted = counts.filter(([, c]) => c === maxVotes).map(([id]) => id);

    if (topVoted.length > 1) {
      room.votingSession.lastResult = 'TIE';
      room.votingSession.tiedPlayerIds = topVoted;
      return room;
    }

    const eliminatedId = topVoted[0];
    const eliminatedPlayer = this.roomsService.getPlayerOrThrow(room, eliminatedId);
    eliminatedPlayer.eliminated = true;
    eliminatedPlayer.revealedTraitKeys = [...TRAIT_CATEGORY_ORDER];
    addLog(room, 'elimination', `${eliminatedPlayer.name} вигнано з бункера (${maxVotes} голос.)`);

    room.votingSessionsRemainingThisRound -= 1;

    if (room.votingSessionsRemainingThisRound > 0) {
      room.votingSession = this.freshVotingSession(room.votingSession.index + 1);
      room.phaseDeadline = Date.now() + VOTING_DISCUSSION_SECONDS * 1000;
      return room;
    }

    room.votingSession = null;
    room.phaseDeadline = null;
    this.advanceAfterRoundResolved(room);
    return room;
  }

  restartVoting(code: string, playerId: string): Room {
    const room = this.roomsService.getRoomOrThrow(code);
    this.roomsService.assertOwner(room, playerId);

    if (room.phase !== RoomPhase.VOTING || !room.votingSession) {
      throw new BadRequestException('Зараз не фаза голосування');
    }
    if (room.votingSession.lastResult !== 'TIE') {
      throw new BadRequestException('Перезапустити голосування можна лише після нічиєї');
    }
    room.votingSession = this.freshVotingSession(room.votingSession.index + 1);
    room.phaseDeadline = Date.now() + VOTING_DISCUSSION_SECONDS * 1000;
    return room;
  }

  private freshVotingSession(index: number): VotingSession {
    return {
      index,
      votes: {},
      lastResult: null,
      tiedPlayerIds: [],
      immunePlayerIds: [],
      doubleVoterIds: [],
    };
  }

  /** Called once a round's reveal circle + all its voting sessions are done. */
  private advanceAfterRoundResolved(room: Room): void {
    if (room.round >= TOTAL_ROUNDS) {
      room.phase = RoomPhase.FINISHED;
      room.activePlayerId = null;
    } else {
      room.phase = RoomPhase.AWAITING_NEXT_ROUND;
    }
  }
}
