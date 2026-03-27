import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RatingController } from './rating.controller';
import { RatingService } from './rating.service';

@Module({
  imports: [HttpModule],
  controllers: [RatingController],
  providers: [RatingService],
})
export class RatingModule {}
