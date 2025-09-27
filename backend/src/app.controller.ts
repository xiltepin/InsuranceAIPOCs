import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { AppService } from './app.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('api/upload-image')
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${basename}-${uniqueSuffix}${ext}`);
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }
  }))
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