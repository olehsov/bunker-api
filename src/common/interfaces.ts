import { RoomPhase, SpecialCardTiming, SpecialCardType, TraitCategory } from './enums';

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

export interface SpecialCardTemplate {
  type: SpecialCardType;
  /** Trait category the card acts on, for trait-based cards. */
  category?: TraitCategory;
  title: string;
  description: string;
  timing: SpecialCardTiming;
  /** 'other': must pick another active player; 'any': may pick anyone active incl. self; 'none': no target. */
  target: 'none' | 'other' | 'any';
}

export interface SpecialCard extends SpecialCardTemplate {
  id: string;
  used: boolean;
  /** Set once played on a target, for the public record. */
  targetPlayerId: string | null;
}

export interface TraitPeek {
  targetId: string;
  category: TraitCategory;
}

export interface GameLogEntry {
  id: number;
  at: number;
  kind: 'round' | 'card' | 'elimination' | 'vote';
  text: string;
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
  specialCards: SpecialCard[];
  /** Traits of other players this player saw privately via a PEEK card. */
  peeks: TraitPeek[];
}

export interface VotingSession {
  index: number;
  votes: Record<string, string>;
  lastResult: 'TIE' | 'ELIMINATED' | null;
  tiedPlayerIds: string[];
  /** Players whose IMMUNITY card protects them for this session only. */
  immunePlayerIds: string[];
  /** Players whose vote counts twice for this session only. */
  doubleVoterIds: string[];
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
  log: GameLogEntry[];
}
