import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('api/upload-image')
  @UseInterceptors(FileInterceptor('image', { dest: './uploads', limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    console.log('Controller received file:', file);
    if (!file) {
      console.error('No file uploaded');
      throw new BadRequestException('No file uploaded');
    }
    try {
      return await this.appService.uploadImage(file);
    } catch (error) {
      console.error('Controller Error:', error);
      throw new BadRequestException(error.message);
    }
  }
}