import { GameLogEntry, Room, VotingSession } from '../common/interfaces';

export function addLog(room: Room, kind: GameLogEntry['kind'], text: string): void {
  const last = room.log[room.log.length - 1];
  room.log.push({ id: (last?.id ?? 0) + 1, at: Date.now(), kind, text });
}

/** Vote totals per target, counting DOUBLE_VOTE voters twice. */
export function tallyVotes(session: VotingSession | null): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!session) {
    return counts;
  }
  for (const [voterId, targetId] of Object.entries(session.votes)) {
    const weight = session.doubleVoterIds.includes(voterId) ? 2 : 1;
    counts[targetId] = (counts[targetId] ?? 0) + weight;
  }
  return counts;
}
