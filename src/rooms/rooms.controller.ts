import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { LeaveRoomDto } from './dto/leave-room.dto';
import { toRoomSnapshot } from '../game/room-view.mapper';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  createRoom(@Body() dto: CreateRoomDto) {
    const { room, playerId } = this.roomsService.createRoom(dto.ownerName);
    return { playerId, room: toRoomSnapshot(room, playerId) };
  }

  @Post(':code/join')
  joinRoom(@Param('code') code: string, @Body() dto: JoinRoomDto) {
    const { room, playerId } = this.roomsService.joinRoom(code, dto.name);
    return { playerId, room: toRoomSnapshot(room, playerId) };
  }

  @Get(':code')
  getRoom(@Param('code') code: string) {
    const room = this.roomsService.getRoomOrThrow(code);
    return toRoomSnapshot(room, null);
  }

  @Post(':code/leave')
  leaveRoom(@Param('code') code: string, @Body() dto: LeaveRoomDto) {
    const room = this.roomsService.removePlayerFromLobby(code, dto.playerId);
    return toRoomSnapshot(room, null);
  }
}
