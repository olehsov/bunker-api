import { RoomsService } from '../rooms/rooms.service';
import { ConfigDataService } from '../config/config-data.service';
import { SPECIAL_CARD_TEMPLATES } from '../config/special-cards.data';
import { Player, Room, SpecialCard } from '../common/interfaces';
import { RoomPhase, SpecialCardTiming, SpecialCardType, TraitCategory } from '../common/enums';
import { GameService } from './game.service';
import { SpecialCardsService } from './special-cards.service';
import { toRoomSnapshot } from './room-view.mapper';

function template(type: SpecialCardType, category?: TraitCategory) {
  const t = SPECIAL_CARD_TEMPLATES.find(
    (c) => c.type === type && (!category || c.category === category),
  );
  if (!t) {
    throw new Error(`No template ${type} ${category ?? ''}`);
  }
  return t;
}

/** Gives `player` exactly one card of the given template, replacing the random deal. */
function giveCard(player: Player, type: SpecialCardType, category?: TraitCategory): SpecialCard {
  const card: SpecialCard = {
    ...template(type, category),
    id: `${player.id}:test`,
    used: false,
    targetPlayerId: null,
  };
  player.specialCards = [card];
  return card;
}

describe('SpecialCardsService', () => {
  let rooms: RoomsService;
  let config: ConfigDataService;
  let game: GameService;
  let cards: SpecialCardsService;
  let room: Room;
  let owner: Player;
  let a: Player;
  let b: Player;
  let c: Player;

  beforeEach(() => {
    rooms = new RoomsService();
    config = new ConfigDataService();
    game = new GameService(rooms, config);
    cards = new SpecialCardsService(rooms, config);

    const created = rooms.createRoom('Owner');
    room = created.room;
    for (const name of ['A', 'B', 'C']) {
      const { playerId } = rooms.joinRoom(room.code, name);
      rooms.setReady(room.code, playerId, true);
    }
    game.startGame(room.code, created.playerId);
    [owner, a, b, c] = room.players;
  });

  it('deals two distinct cards per player, the first always playable outside voting', () => {
    for (const p of room.players) {
      expect(p.specialCards).toHaveLength(2);
      expect(p.specialCards[0].timing).toBe(SpecialCardTiming.ANY);
      expect(p.specialCards[0].title).not.toBe(p.specialCards[1].title);
    }
  });

  it('swaps a trait category between two players and logs it publicly', () => {
    const card = giveCard(a, SpecialCardType.SWAP_TRAIT, TraitCategory.PROFESSION);
    const aProf = a.traits![TraitCategory.PROFESSION];
    const bProf = b.traits![TraitCategory.PROFESSION];

    cards.playCard(room.code, a.id, card.id, b.id);

    expect(a.traits![TraitCategory.PROFESSION]).toBe(bProf);
    expect(b.traits![TraitCategory.PROFESSION]).toBe(aProf);
    expect(card.used).toBe(true);
    expect(room.log.at(-1)!.text).toContain('Обмін професіями');
  });

  it('rejects playing a used card, a missing target, or self-target on "other" cards', () => {
    const card = giveCard(a, SpecialCardType.SWAP_TRAIT, TraitCategory.HEALTH);
    expect(() => cards.playCard(room.code, a.id, card.id, null)).toThrow('Оберіть гравця');
    expect(() => cards.playCard(room.code, a.id, card.id, a.id)).toThrow('іншого гравця');
    cards.playCard(room.code, a.id, card.id, b.id);
    expect(() => cards.playCard(room.code, a.id, card.id, b.id)).toThrow('вже зіграно');
  });

  it('heals any player, including yourself', () => {
    const card = giveCard(a, SpecialCardType.HEAL);
    cards.playCard(room.code, a.id, card.id, a.id);
    expect(a.traits![TraitCategory.HEALTH].label).toBe('Ідеально здоровий');
  });

  it('PEEK reveals one hidden trait to the viewer only', () => {
    const card = giveCard(a, SpecialCardType.PEEK);
    cards.playCard(room.code, a.id, card.id, b.id);

    const peeked = a.peeks[0].category;
    const bAsSeenByA = toRoomSnapshot(room, a.id).players.find((p) => p.id === b.id)!;
    const bAsSeenByC = toRoomSnapshot(room, c.id).players.find((p) => p.id === b.id)!;

    expect(bAsSeenByA.traits.find((t) => t.category === peeked)!.revealed).toBe(true);
    expect(bAsSeenByA.publiclyRevealedCategories).not.toContain(peeked);
    expect(bAsSeenByC.traits.find((t) => t.category === peeked)!.revealed).toBe(false);
  });

  it('FORCE_REVEAL publicly opens a hidden trait of the target', () => {
    const card = giveCard(a, SpecialCardType.FORCE_REVEAL);
    cards.playCard(room.code, a.id, card.id, b.id);
    expect(b.revealedTraitKeys).toHaveLength(1);
  });

  it('a forced profession reveal frees that player from the round-1 profession rule', () => {
    const card = giveCard(a, SpecialCardType.FORCE_REVEAL);
    b.revealedTraitKeys = [];
    jest.spyOn(Math, 'random').mockReturnValue(0); // first hidden = PROFESSION
    cards.playCard(room.code, a.id, card.id, b.id);
    jest.restoreAllMocks();
    expect(b.revealedTraitKeys).toEqual([TraitCategory.PROFESSION]);

    game.startRound(room.code, owner.id);
    game.revealTrait(room.code, owner.id, TraitCategory.PROFESSION);
    game.revealTrait(room.code, a.id, TraitCategory.PROFESSION);
    expect(room.activePlayerId).toBe(b.id);
    game.revealTrait(room.code, b.id, TraitCategory.HEALTH);
    expect(b.revealedTraitKeys).toContain(TraitCategory.HEALTH);
  });

  it('own unplayed cards are hidden from other players but their count is public', () => {
    const asSeenByB = toRoomSnapshot(room, b.id).players.find((p) => p.id === a.id)!;
    const asSeenByA = toRoomSnapshot(room, a.id).players.find((p) => p.id === a.id)!;
    expect(asSeenByB.specialCards).toHaveLength(0);
    expect(asSeenByB.specialCardsLeft).toBe(2);
    expect(asSeenByA.specialCards).toHaveLength(2);
  });

  describe('voting cards', () => {
    function goToVoting() {
      room.phase = RoomPhase.AWAITING_VOTE_START;
      game.startVoting(room.code, owner.id);
    }

    it('cannot be played outside a vote', () => {
      const card = giveCard(a, SpecialCardType.IMMUNITY);
      expect(() => cards.playCard(room.code, a.id, card.id)).toThrow('лише під час голосування');
    });

    it('IMMUNITY drops existing votes and blocks new ones against the player', () => {
      goToVoting();
      game.castVote(room.code, b.id, a.id);
      const card = giveCard(a, SpecialCardType.IMMUNITY);
      cards.playCard(room.code, a.id, card.id);

      expect(room.votingSession!.votes[b.id]).toBeUndefined();
      expect(() => game.castVote(room.code, c.id, a.id)).toThrow('імунітет');
    });

    it('DOUBLE_VOTE makes one vote outweigh another', () => {
      goToVoting();
      const card = giveCard(a, SpecialCardType.DOUBLE_VOTE);
      cards.playCard(room.code, a.id, card.id);

      game.castVote(room.code, owner.id, c.id);
      game.castVote(room.code, a.id, b.id);
      game.castVote(room.code, b.id, c.id);
      game.castVote(room.code, c.id, b.id);
      game.endVoting(room.code, owner.id);

      // B: 2 (a, doubled) + 1 (c) = 3, C: 2 → B is out, no tie.
      expect(b.eliminated).toBe(true);
      expect(room.log.at(-1)!.kind).toBe('elimination');
    });

    it('REVOTE clears all votes', () => {
      goToVoting();
      game.castVote(room.code, b.id, c.id);
      const card = giveCard(a, SpecialCardType.REVOTE);
      cards.playCard(room.code, a.id, card.id);
      expect(room.votingSession!.votes).toEqual({});
    });
  });
});
