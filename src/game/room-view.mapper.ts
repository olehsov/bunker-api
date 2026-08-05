import { Player, Room, TraitCard } from '../common/interfaces';
import { RoomPhase, TraitCategory, TRAIT_CATEGORY_ORDER } from '../common/enums';

export interface TraitCardView {
  category: TraitCategory;
  revealed: boolean;
  card: TraitCard | null;
}

export interface PlayerView {
  id: string;
  name: string;
  isOwner: boolean;
  ready: boolean;
  connected: boolean;
  eliminated: boolean;
  isSelf: boolean;
  hasTraits: boolean;
  traits: TraitCardView[];
  /**
   * Categories this player has opened publicly, regardless of who's viewing.
   * Lets a player's own client tell "revealed to everyone" apart from
   * "visible to me because it's mine" for their own (always-visible) cards.
   */
  publiclyRevealedCategories: TraitCategory[];
}

export interface RoomSnapshot {
  code: string;
  phase: Room['phase'];
  round: number;
  totalRounds: number;
  bunkerId: string | null;
  cataclysmId: string | null;
  bunkerLocked: boolean;
  cataclysmLocked: boolean;
  ownerId: string;
  activePlayerId: string | null;
  votingSessionsRemainingThisRound: number;
  phaseDeadline: number | null;
  voting: {
    /** Increments each time voting (re)starts, so clients can detect "new session, restart my timer". */
    sessionIndex: number;
    votes: Record<string, string>;
    voteCounts: Record<string, number>;
    allVoted: boolean;
    lastResult: 'TIE' | 'ELIMINATED' | null;
    tiedPlayerIds: string[];
  } | null;
  players: PlayerView[];
  viewerPlayerId: string | null;
}

/**
 * A player's own traits are always fully visible to themselves. An eliminated
 * player's traits become fully visible to everyone, and once the game is
 * FINISHED every remaining player's traits are revealed to everyone too.
 */
function buildTraitViews(player: Player, fullyVisible: boolean): TraitCardView[] {
  return TRAIT_CATEGORY_ORDER.map((category) => {
    const revealed = fullyVisible || player.revealedTraitKeys.includes(category);
    return {
      category,
      revealed,
      card: revealed && player.traits ? player.traits[category] : null,
    };
  });
}

function toPlayerView(player: Player, viewerId: string | null, gameFinished: boolean): PlayerView {
  const isSelf = viewerId !== null && player.id === viewerId;
  // Public visibility ignores isSelf on purpose: a player's own view must still be
  // able to tell "only I can see this" apart from "everyone can see this now".
  const publiclyVisible = player.eliminated || gameFinished;
  const fullyVisible = isSelf || publiclyVisible;
  return {
    id: player.id,
    name: player.name,
    isOwner: player.isOwner,
    ready: player.ready,
    connected: player.connected,
    eliminated: player.eliminated,
    isSelf,
    hasTraits: player.traits !== null,
    traits: player.traits ? buildTraitViews(player, fullyVisible) : [],
    publiclyRevealedCategories: publiclyVisible
      ? [...TRAIT_CATEGORY_ORDER]
      : [...player.revealedTraitKeys],
  };
}

export function toRoomSnapshot(room: Room, viewerId: string | null): RoomSnapshot {
  const activePlayers = room.players.filter((p) => !p.eliminated);
  const gameFinished = room.phase === RoomPhase.FINISHED;
  const votes = room.votingSession?.votes ?? {};
  const voteCounts: Record<string, number> = {};
  for (const targetId of Object.values(votes)) {
    voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
  }

  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    totalRounds: 5,
    bunkerId: room.bunkerId,
    cataclysmId: room.cataclysmId,
    bunkerLocked: room.bunkerLocked,
    cataclysmLocked: room.cataclysmLocked,
    ownerId: room.ownerId,
    activePlayerId: room.activePlayerId,
    votingSessionsRemainingThisRound: room.votingSessionsRemainingThisRound,
    phaseDeadline: room.phaseDeadline,
    voting: room.votingSession
      ? {
          sessionIndex: room.votingSession.index,
          votes,
          voteCounts,
          allVoted: activePlayers.every((p) => votes[p.id] !== undefined),
          lastResult: room.votingSession.lastResult,
          tiedPlayerIds: room.votingSession.tiedPlayerIds,
        }
      : null,
    players: room.players.map((p) => toPlayerView(p, viewerId, gameFinished)),
    viewerPlayerId: viewerId,
  };
}
