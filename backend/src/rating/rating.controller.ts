import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RatingService } from './rating.service';

@Controller('api/rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get('health')
  health() {
    return this.ratingService.health();
  }

  @Post('predict')
  predict(@Body() body: Record<string, unknown>) {
    return this.ratingService.predict(body);
  }

  @Post('train')
  train(@Query('samples') samples?: string) {
    return this.ratingService.train(samples ? parseInt(samples, 10) : 10000);
  }

  @Get('model/info')
  modelInfo() {
    return this.ratingService.modelInfo();
  }
}
