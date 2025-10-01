import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException, Body } from '@nestjs/common';
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
    console.log('==========================================');
    console.log('NESTJS CONTROLLER: Received file from Angular');
    console.log('==========================================');
    console.log('File details:', {
      fieldname: file?.fieldname,
      originalname: file?.originalname,
      encoding: file?.encoding,
      mimetype: file?.mimetype,
      size: file?.size,
      destination: file?.destination,
      filename: file?.filename,
      path: file?.path
    });
    console.log('==========================================');
    
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

  @Post('api/process-raw-text')
  async processRawText(@Body() body: { rawText: string }) {
    console.log('==========================================');
    console.log('NESTJS CONTROLLER: Processing raw text directly');
    console.log('==========================================');
    console.log('Raw text length:', body.rawText?.length);
    console.log('Raw text preview:', body.rawText?.substring(0, 200));
    console.log('==========================================');
    
    if (!body.rawText || body.rawText.trim().length === 0) {
      console.error('No raw text provided');
      throw new BadRequestException('No raw text provided');
    }
    
    try {
      const result = await this.appService.processRawText(body.rawText);
      console.log('==========================================');
      console.log('NESTJS CONTROLLER: Sending raw text result back to Angular');
      console.log('Result keys:', Object.keys(result));
      console.log('==========================================');
      return result;
    } catch (error) {
      console.error('Controller Error processing raw text:', error);
      throw new BadRequestException(error.message);
    }
  }
}