import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { RoomsModule } from '../rooms/rooms.module';
import { ConfigDataModule } from '../config/config-data.module';

@Module({
  imports: [RoomsModule, ConfigDataModule],
  providers: [GameService, GameGateway],
})
export class GameModule {}
