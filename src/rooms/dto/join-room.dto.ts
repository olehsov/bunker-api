import { IsString, Length } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @Length(1, 30)
  name!: string;
}
