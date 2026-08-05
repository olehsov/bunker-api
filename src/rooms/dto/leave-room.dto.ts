import { IsUUID } from 'class-validator';

export class LeaveRoomDto {
  @IsUUID()
  playerId!: string;
}
