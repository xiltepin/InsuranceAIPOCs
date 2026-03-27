import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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
    } catch (err: any) {
      const status = err.response?.status || HttpStatus.SERVICE_UNAVAILABLE;
      const detail = err.response?.data?.detail || 'Rating engine unavailable';
      throw new HttpException(detail, status);
    }
  }

  async train(nSamples = 10000) {
    try {
      const { data } = await firstValueFrom(
        this.http.post(`${RATING_ENGINE_URL}/train`, { n_samples: nSamples }),
      );
      return data;
    } catch (err: any) {
      throw new HttpException('Training failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async modelInfo() {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${RATING_ENGINE_URL}/model/info`),
      );
      return data;
    } catch (err: any) {
      throw new HttpException('Model info unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async health() {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${RATING_ENGINE_URL}/health`),
      );
      return data;
    } catch {
      return { status: 'unavailable', model_ready: false };
    }
  }
}
