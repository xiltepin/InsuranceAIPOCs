import { Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
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
  train(@Body() body: { n_samples?: number; source?: string }) {
    return this.ratingService.train(body.n_samples ?? 10000, body.source ?? 'synthetic');
  }

  @Post('upload-excel')
  @UseInterceptors(FileInterceptor('file'))
  uploadExcel(@UploadedFile() file: Express.Multer.File) {
    return this.ratingService.uploadExcel(file.buffer, file.originalname);
  }

  @Get('model/info')
  modelInfo() { return this.ratingService.modelInfo(); }

  @Get('db-status')
  dbStatus() { return this.ratingService.dbStatus(); }
}
