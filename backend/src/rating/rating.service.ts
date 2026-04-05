import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Response } from 'express';
import * as http from 'http';
import FormData = require('form-data');

const RATING_ENGINE_URL = process.env.RATING_ENGINE_URL || 'http://localhost:8000';

@Injectable()
export class RatingService {
  constructor(private readonly http: HttpService) {}

  async predict(body: Record<string, unknown>) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${RATING_ENGINE_URL}/predict`, body),
      );
      return data;
    } catch (err) {
      throw new HttpException(
        err.response?.data?.detail || 'Rating engine unavailable',
        err.response?.status || HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async train(nSamples = 10000, source = 'synthetic') {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${RATING_ENGINE_URL}/train`, { n_samples: nSamples, source }),
      );
      return data;
    } catch {
      throw new HttpException('Training failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  streamTrain(nSamples: number, source: string, res: Response) {
    const url = `${RATING_ENGINE_URL}/train/stream?n_samples=${nSamples}&source=${source}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    http.get(url, (upstream) => {
      upstream.pipe(res);
      res.on('close', () => upstream.destroy());
    }).on('error', (err) => {
      res.write(`data: {"error":"${err.message}","pct":0}\n\n`);
      res.end();
    });
  }

  async uploadExcel(fileBuffer: Buffer, originalName: string) {
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: originalName,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${RATING_ENGINE_URL}/upload-excel`, form, {
          headers: form.getHeaders(),
        }),
      );
      return data;
    } catch (err) {
      throw new HttpException(
        err.response?.data?.detail || 'Excel upload failed',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  async modelInfo() {
    try {
      const { data } = await firstValueFrom(this.http.get(`${RATING_ENGINE_URL}/model/info`));
      return data;
    } catch {
      throw new HttpException('Model info unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async health() {
    try {
      const { data } = await firstValueFrom(this.http.get(`${RATING_ENGINE_URL}/health`));
      return data;
    } catch {
      return { status: 'unavailable', model_ready: false, excel_loaded: false };
    }
  }

  async dbStatus() {
    try {
      const { data } = await firstValueFrom(this.http.get(`${RATING_ENGINE_URL}/db/status`));
      return data;
    } catch {
      return { available: false, total_rows: 0, message: 'DB unreachable' };
    }
  }
}
