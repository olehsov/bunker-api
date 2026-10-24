export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 16;
export const TOTAL_ROUNDS = 5;
export const ROOM_CODE_LENGTH = 6;
export const REVEAL_TURN_SECONDS = 60;
export const VOTING_DISCUSSION_SECONDS = 60;
export const SPECIAL_CARDS_PER_PLAYER = 2;
/** How many recent log entries are sent to clients. */
export const LOG_ENTRIES_IN_SNAPSHOT = 30;

/**
 * Number of voting sessions (each eliminates exactly one player) held during
 * each round, indexed by the room's player count at game start.
 * Index 0 = round 1 ... index 4 = round 5.
 * Source: the elimination table from the game design doc.
 */
export const ELIMINATION_SCHEDULE: Record<number, number[]> = {
  4: [0, 0, 0, 1, 1],
  5: [0, 0, 1, 1, 1],
  6: [0, 0, 1, 1, 1],
  7: [0, 1, 1, 1, 1],
  8: [0, 1, 1, 1, 1],
  9: [0, 1, 1, 1, 2],
  10: [0, 1, 1, 1, 2],
  11: [0, 1, 1, 2, 2],
  12: [0, 1, 1, 2, 2],
  13: [0, 1, 2, 2, 2],
  14: [0, 1, 2, 2, 2],
  15: [0, 2, 2, 2, 2],
  16: [0, 2, 2, 2, 2],
};

export function votingSessionsForRound(initialPlayerCount: number, round: number): number {
  const schedule = ELIMINATION_SCHEDULE[initialPlayerCount];
  if (!schedule) {
    throw new Error(`No elimination schedule defined for ${initialPlayerCount} players`);
  }
  return schedule[round - 1] ?? 0;
}
