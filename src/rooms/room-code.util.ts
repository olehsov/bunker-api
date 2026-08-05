import { ROOM_CODE_LENGTH } from '../game/constants/game.constants';

export function generateRoomCode(): string {
  const min = 10 ** (ROOM_CODE_LENGTH - 1);
  const max = 10 ** ROOM_CODE_LENGTH - 1;
  const code = Math.floor(min + Math.random() * (max - min + 1));
  return code.toString();
}
