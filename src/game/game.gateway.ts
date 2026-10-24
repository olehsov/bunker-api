import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RoomsService } from '../rooms/rooms.service';
import { GameService } from './game.service';
import { SpecialCardsService } from './special-cards.service';
import { toRoomSnapshot } from './room-view.mapper';
import { Room } from '../common/interfaces';
import { RoomPhase, TraitCategory } from '../common/enums';

interface SocketData {
  code: string;
  playerId: string;
}

@WebSocketGateway({
  namespace: '/game',
  cors: { origin: '*' },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  /** roomCode -> playerId -> socketId, used to push each viewer their own masked room snapshot. */
  private readonly connections = new Map<string, Map<string, string>>();

  /** roomCode -> pending timer for the current REVEAL turn's or VOTING session's deadline. */
  private readonly turnTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly roomsService: RoomsService,
    private readonly gameService: GameService,
    private readonly specialCardsService: SpecialCardsService,
  ) {}

  handleConnection(client: Socket) {
    const code = String(client.handshake.query.code ?? '');
    const playerId = String(client.handshake.query.playerId ?? '');

    try {
      const room = this.roomsService.getRoomOrThrow(code);
      this.roomsService.getPlayerOrThrow(room, playerId);

      (client.data as SocketData) = { code, playerId };
      client.join(code);

      let roomConnections = this.connections.get(code);
      if (!roomConnections) {
        roomConnections = new Map();
        this.connections.set(code, roomConnections);
      }
      roomConnections.set(playerId, client.id);

      this.roomsService.setConnected(code, playerId, true);
      this.broadcastRoomState(room);
    } catch (error) {
      client.emit('room:error', { message: (error as Error).message });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const data = client.data as SocketData | undefined;
    if (!data) {
      return;
    }
    const roomConnections = this.connections.get(data.code);
    if (roomConnections?.get(data.playerId) === client.id) {
      roomConnections.delete(data.playerId);
    }
    const room = this.roomsService.setConnected(data.code, data.playerId, false);
    if (room) {
      this.broadcastRoomState(room);
    }
  }

  /** Tells a removed player's socket why and drops it, so it can't reconnect as a ghost. */
  private disconnectPlayer(code: string, playerId: string, event: string): void {
    const roomConnections = this.connections.get(code);
    const socketId = roomConnections?.get(playerId);
    roomConnections?.delete(playerId);
    if (!socketId) {
      return;
    }
    this.server.to(socketId).emit(event);
    this.server.in(socketId).disconnectSockets(true);
  }

  private broadcastRoomState(room: Room): void {
    const roomConnections = this.connections.get(room.code);
    for (const player of room.players) {
      const socketId = roomConnections?.get(player.id);
      if (socketId) {
        this.server.to(socketId).emit('room:state', toRoomSnapshot(room, player.id));
      }
    }
  }

  private handleAction(client: Socket, action: (data: SocketData) => Room): void {
    const data = client.data as SocketData | undefined;
    if (!data) {
      client.emit('room:error', { message: 'Не автентифіковано' });
      return;
    }
    try {
      const room = action(data);
      this.broadcastRoomState(room);
      this.scheduleTurnTimeout(room);
    } catch (error) {
      client.emit('room:error', { message: (error as Error).message });
    }
  }

  /**
   * Keeps the server-side `room.phaseDeadline` enforced: in REVEAL it
   * auto-reveals a random trait for the active player, in VOTING it casts
   * random votes for everyone who hasn't voted. Any previous timer for the
   * room is cleared first, so this is safe to call after every action.
   */
  private scheduleTurnTimeout(room: Room): void {
    const existing = this.turnTimers.get(room.code);
    if (existing) {
      clearTimeout(existing);
      this.turnTimers.delete(room.code);
    }
    const onTimeout =
      room.phase === RoomPhase.REVEAL
        ? (code: string) => this.gameService.autoRevealTimeout(code)
        : room.phase === RoomPhase.VOTING
          ? (code: string) => this.gameService.autoVoteTimeout(code)
          : null;
    if (!onTimeout || room.phaseDeadline === null) {
      return;
    }

    const delay = Math.max(0, room.phaseDeadline - Date.now());
    const timer = setTimeout(() => {
      this.turnTimers.delete(room.code);
      try {
        const updated = onTimeout(room.code);
        this.broadcastRoomState(updated);
        this.scheduleTurnTimeout(updated);
      } catch (error) {
        this.logger.error(`Phase timeout failed for room ${room.code}`, error as Error);
      }
    }, delay);
    this.turnTimers.set(room.code, timer);
  }

  @SubscribeMessage('player:rename')
  onRename(@ConnectedSocket() client: Socket, @MessageBody() body: { name: string }) {
    this.handleAction(client, (d) => this.roomsService.renamePlayer(d.code, d.playerId, body.name));
  }

  @SubscribeMessage('player:ready')
  onReady(@ConnectedSocket() client: Socket, @MessageBody() body: { ready: boolean }) {
    this.handleAction(client, (d) => this.roomsService.setReady(d.code, d.playerId, body.ready));
  }

  @SubscribeMessage('owner:selectBunker')
  onSelectBunker(@ConnectedSocket() client: Socket, @MessageBody() body: { bunkerId: string }) {
    this.handleAction(client, (d) => this.roomsService.selectBunker(d.code, d.playerId, body.bunkerId));
  }

  @SubscribeMessage('owner:selectCataclysm')
  onSelectCataclysm(@ConnectedSocket() client: Socket, @MessageBody() body: { cataclysmId: string }) {
    this.handleAction(client, (d) =>
      this.roomsService.selectCataclysm(d.code, d.playerId, body.cataclysmId),
    );
  }

  @SubscribeMessage('owner:kickPlayer')
  onKickPlayer(@ConnectedSocket() client: Socket, @MessageBody() body: { playerId: string }) {
    this.handleAction(client, (d) => {
      const room = this.roomsService.kickPlayer(d.code, d.playerId, body?.playerId);
      this.disconnectPlayer(room.code, body.playerId, 'room:kicked');
      return room;
    });
  }

  @SubscribeMessage('owner:startGame')
  onStartGame(@ConnectedSocket() client: Socket) {
    this.handleAction(client, (d) => this.gameService.startGame(d.code, d.playerId));
  }

  @SubscribeMessage('owner:startRound')
  onStartRound(@ConnectedSocket() client: Socket) {
    this.handleAction(client, (d) => this.gameService.startRound(d.code, d.playerId));
  }

  @SubscribeMessage('player:revealTrait')
  onRevealTrait(@ConnectedSocket() client: Socket, @MessageBody() body: { category: TraitCategory }) {
    this.handleAction(client, (d) =>
      this.gameService.revealTrait(d.code, d.playerId, body.category),
    );
  }

  @SubscribeMessage('player:playSpecialCard')
  onPlaySpecialCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { cardId: string; targetPlayerId?: string | null },
  ) {
    this.handleAction(client, (d) =>
      this.specialCardsService.playCard(d.code, d.playerId, body?.cardId, body?.targetPlayerId),
    );
  }

  @SubscribeMessage('owner:startVoting')
  onStartVoting(@ConnectedSocket() client: Socket) {
    this.handleAction(client, (d) => this.gameService.startVoting(d.code, d.playerId));
  }

  @SubscribeMessage('player:castVote')
  onCastVote(@ConnectedSocket() client: Socket, @MessageBody() body: { targetPlayerId: string }) {
    this.handleAction(client, (d) =>
      this.gameService.castVote(d.code, d.playerId, body.targetPlayerId),
    );
  }

  @SubscribeMessage('owner:endVoting')
  onEndVoting(@ConnectedSocket() client: Socket) {
    this.handleAction(client, (d) => this.gameService.endVoting(d.code, d.playerId));
  }

  @SubscribeMessage('owner:restartVoting')
  onRestartVoting(@ConnectedSocket() client: Socket) {
    this.handleAction(client, (d) => this.gameService.restartVoting(d.code, d.playerId));
  }
}
