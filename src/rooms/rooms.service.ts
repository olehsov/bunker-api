import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { Player, Room } from '../common/interfaces';
import { RoomPhase } from '../common/enums';
import { MAX_PLAYERS } from '../game/constants/game.constants';
import { generateRoomCode } from './room-code.util';

@Injectable()
export class RoomsService {
  private readonly rooms = new Map<string, Room>();

  createRoom(ownerName: string): { room: Room; playerId: string } {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const ownerId = uuid();
    const owner: Player = {
      id: ownerId,
      name: ownerName.trim(),
      isOwner: true,
      ready: true,
      connected: false,
      eliminated: false,
      joinOrder: 0,
      traits: null,
      revealedTraitKeys: [],
      specialCards: [],
      peeks: [],
    };

    const room: Room = {
      code,
      createdAt: Date.now(),
      phase: RoomPhase.LOBBY,
      players: [owner],
      ownerId,
      bunkerId: null,
      cataclysmId: null,
      bunkerLocked: false,
      cataclysmLocked: false,
      round: 0,
      initialPlayerCount: 0,
      activePlayerId: null,
      currentRoundMoveOrder: [],
      previousRoundMoveOrder: [],
      votingSessionsRemainingThisRound: 0,
      votingSession: null,
      phaseDeadline: null,
      log: [],
    };

    this.rooms.set(code, room);
    return { room, playerId: ownerId };
  }

  joinRoom(code: string, name: string): { room: Room; playerId: string } {
    const room = this.getRoomOrThrow(code);

    if (room.phase !== RoomPhase.LOBBY) {
      throw new BadRequestException('Гра вже розпочалася, доєднатися неможливо');
    }
    if (room.players.length >= MAX_PLAYERS) {
      throw new BadRequestException(`Кімната заповнена (максимум ${MAX_PLAYERS} гравців)`);
    }

    const playerId = uuid();
    const player: Player = {
      id: playerId,
      name: name.trim(),
      isOwner: false,
      ready: false,
      connected: false,
      eliminated: false,
      // Max + 1 rather than length: kicked/left players leave gaps.
      joinOrder: Math.max(...room.players.map((p) => p.joinOrder)) + 1,
      traits: null,
      revealedTraitKeys: [],
      specialCards: [],
      peeks: [],
    };
    room.players.push(player);
    return { room, playerId };
  }

  getRoomOrThrow(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) {
      throw new NotFoundException(`Кімнату "${code}" не знайдено`);
    }
    return room;
  }

  getPlayerOrThrow(room: Room, playerId: string): Player {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      throw new NotFoundException('Гравця не знайдено в цій кімнаті');
    }
    return player;
  }

  assertOwner(room: Room, playerId: string): void {
    if (room.ownerId !== playerId) {
      throw new ForbiddenException('Цю дію може виконати лише власник кімнати');
    }
  }

  renamePlayer(code: string, playerId: string, name: string): Room {
    const room = this.getRoomOrThrow(code);
    const player = this.getPlayerOrThrow(room, playerId);
    if (room.phase !== RoomPhase.LOBBY) {
      throw new BadRequestException('Змінювати ім’я можна лише в лобі');
    }
    player.name = name.trim();
    return room;
  }

  setReady(code: string, playerId: string, ready: boolean): Room {
    const room = this.getRoomOrThrow(code);
    const player = this.getPlayerOrThrow(room, playerId);
    if (room.phase !== RoomPhase.LOBBY) {
      throw new BadRequestException('Готовність можна змінювати лише в лобі');
    }
    if (player.isOwner) {
      return room;
    }
    player.ready = ready;
    return room;
  }

  selectBunker(code: string, playerId: string, bunkerId: string): Room {
    const room = this.getRoomOrThrow(code);
    this.assertOwner(room, playerId);
    if (room.phase !== RoomPhase.LOBBY) {
      throw new BadRequestException('Бункер можна обрати лише в лобі');
    }
    room.bunkerId = bunkerId;
    room.bunkerLocked = true;
    return room;
  }

  selectCataclysm(code: string, playerId: string, cataclysmId: string): Room {
    const room = this.getRoomOrThrow(code);
    this.assertOwner(room, playerId);
    if (room.phase !== RoomPhase.LOBBY) {
      throw new BadRequestException('Катаклізм можна обрати лише в лобі');
    }
    room.cataclysmId = cataclysmId;
    room.cataclysmLocked = true;
    return room;
  }

  setConnected(code: string, playerId: string, connected: boolean): Room | null {
    const room = this.rooms.get(code);
    if (!room) {
      return null;
    }
    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      return null;
    }
    player.connected = connected;
    return room;
  }

  removePlayerFromLobby(code: string, playerId: string): Room {
    const room = this.getRoomOrThrow(code);
    if (room.phase !== RoomPhase.LOBBY) {
      throw new BadRequestException('Вийти можна лише поки гра не почалась');
    }
    if (room.ownerId === playerId) {
      this.rooms.delete(code);
      return room;
    }
    room.players = room.players.filter((p) => p.id !== playerId);
    return room;
  }

  kickPlayer(code: string, ownerId: string, targetPlayerId: string): Room {
    const room = this.getRoomOrThrow(code);
    this.assertOwner(room, ownerId);
    if (room.phase !== RoomPhase.LOBBY) {
      throw new BadRequestException('Вигнати гравця можна лише в лобі');
    }
    if (targetPlayerId === ownerId) {
      throw new BadRequestException('Не можна вигнати самого себе');
    }
    this.getPlayerOrThrow(room, targetPlayerId);
    room.players = room.players.filter((p) => p.id !== targetPlayerId);
    return room;
  }

  deleteRoom(code: string): void {
    this.rooms.delete(code);
  }
}
