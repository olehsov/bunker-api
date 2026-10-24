import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { SpecialCardsService } from './special-cards.service';
import { RoomsModule } from '../rooms/rooms.module';
import { ConfigDataModule } from '../config/config-data.module';

@Module({
  imports: [RoomsModule, ConfigDataModule],
  providers: [GameService, SpecialCardsService, GameGateway],
})
export class GameModule {}
