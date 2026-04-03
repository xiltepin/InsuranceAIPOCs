import { Body, Controller, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RatingService } from './rating.service';

@Controller('api/rating')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get('health')
  health() { return this.ratingService.health(); }

  @Post('predict')
  predict(@Body() body: Record<string, unknown>) {
    return this.ratingService.predict(body);
  }

  @Post('train')
  train(@Query('samples') samples?: string) {
    return this.ratingService.train(samples ? parseInt(samples, 10) : 10000);
  }

  @Post('upload-excel')
  @UseInterceptors(FileInterceptor('file'))
  uploadExcel(@UploadedFile() file: Express.Multer.File) {
    return this.ratingService.uploadExcel(file.buffer, file.originalname);
  }

  @Get('model/info')
  modelInfo() { return this.ratingService.modelInfo(); }
}
