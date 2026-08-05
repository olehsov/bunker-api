import { RoomPhase, TraitCategory } from './enums';

export interface TraitCard {
  label: string;
  detail?: string;
}

export type PlayerTraits = Record<TraitCategory, TraitCard>;

export interface BunkerConfig {
  id: string;
  name: string;
  description: string;
  areaSqm: number;
  survivalDurationYears: number;
  foodSupplyDescription: string;
  rooms: string[];
  problems: string[];
  foodAssortment: string[];
  items: string[];
}

export interface CataclysmConfig {
  id: string;
  name: string;
  description: string;
}

export interface Player {
  id: string;
  name: string;
  isOwner: boolean;
  ready: boolean;
  connected: boolean;
  eliminated: boolean;
  joinOrder: number;
  traits: PlayerTraits | null;
  revealedTraitKeys: TraitCategory[];
}

export interface VotingSession {
  index: number;
  votes: Record<string, string>;
  lastResult: 'TIE' | 'ELIMINATED' | null;
  tiedPlayerIds: string[];
}

export interface Room {
  code: string;
  createdAt: number;
  phase: RoomPhase;
  players: Player[];
  ownerId: string;
  bunkerId: string | null;
  cataclysmId: string | null;
  bunkerLocked: boolean;
  cataclysmLocked: boolean;
  round: number;
  initialPlayerCount: number;
  activePlayerId: string | null;
  currentRoundMoveOrder: string[];
  previousRoundMoveOrder: string[];
  votingSessionsRemainingThisRound: number;
  votingSession: VotingSession | null;
  /** Epoch ms when the current REVEAL turn or VOTING session ends; null when no timer is active. */
  phaseDeadline: number | null;
}
