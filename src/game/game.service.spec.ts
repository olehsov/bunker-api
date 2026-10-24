import { RoomsService } from '../rooms/rooms.service';
import { ConfigDataService } from '../config/config-data.service';
import { Player, Room } from '../common/interfaces';
import { RoomPhase } from '../common/enums';
import { GameService } from './game.service';

describe('GameService voting timeout', () => {
  let rooms: RoomsService;
  let game: GameService;
  let room: Room;
  let ownerId: string;
  let players: Player[];

  beforeEach(() => {
    rooms = new RoomsService();
    game = new GameService(rooms, new ConfigDataService());

    const created = rooms.createRoom('Owner');
    room = created.room;
    ownerId = created.playerId;
    for (const name of ['A', 'B', 'C']) {
      const { playerId } = rooms.joinRoom(room.code, name);
      rooms.setReady(room.code, playerId, true);
    }
    game.startGame(room.code, ownerId);
    players = room.players;
    room.phase = RoomPhase.AWAITING_VOTE_START;
    room.votingSessionsRemainingThisRound = 1;
    game.startVoting(room.code, ownerId);
  });

  it('casts a valid random vote for every player who has not voted', () => {
    const [owner, a, b, c] = players;
    game.castVote(room.code, a.id, b.id);
    room.votingSession!.immunePlayerIds.push(c.id);

    game.autoVoteTimeout(room.code);

    const votes = room.votingSession!.votes;
    expect(votes[a.id]).toBe(b.id);
    for (const p of [owner, b, c]) {
      expect(votes[p.id]).toBeDefined();
      expect(votes[p.id]).not.toBe(p.id);
      expect(votes[p.id]).not.toBe(c.id);
    }
    expect(room.phaseDeadline).toBeNull();
    expect(room.log.at(-1)?.kind).toBe('vote');
    expect(() => game.endVoting(room.code, ownerId)).not.toThrow();
  });

  it('leaves a resolved (tied) session alone but clears its deadline', () => {
    room.votingSession!.lastResult = 'TIE';
    game.autoVoteTimeout(room.code);
    expect(room.votingSession!.votes).toEqual({});
    expect(room.phaseDeadline).toBeNull();
  });
});

describe('RoomsService.kickPlayer', () => {
  let rooms: RoomsService;
  let room: Room;
  let ownerId: string;
  let guestId: string;

  beforeEach(() => {
    rooms = new RoomsService();
    const created = rooms.createRoom('Owner');
    room = created.room;
    ownerId = created.playerId;
    guestId = rooms.joinRoom(room.code, 'Guest').playerId;
  });

  it('lets the owner remove a player from the lobby', () => {
    rooms.kickPlayer(room.code, ownerId, guestId);
    expect(room.players.map((p) => p.id)).toEqual([ownerId]);
  });

  it('rejects non-owners, self-kicks and kicks after the game started', () => {
    const other = rooms.joinRoom(room.code, 'Other').playerId;
    expect(() => rooms.kickPlayer(room.code, guestId, other)).toThrow();
    expect(() => rooms.kickPlayer(room.code, ownerId, ownerId)).toThrow();
    room.phase = RoomPhase.READY_FOR_ROUND;
    expect(() => rooms.kickPlayer(room.code, ownerId, guestId)).toThrow();
  });

  it('keeps join order unique after a kick', () => {
    rooms.joinRoom(room.code, 'Second');
    rooms.kickPlayer(room.code, ownerId, guestId);
    rooms.joinRoom(room.code, 'Third');
    const orders = room.players.map((p) => p.joinOrder);
    expect(new Set(orders).size).toBe(orders.length);
  });
});
