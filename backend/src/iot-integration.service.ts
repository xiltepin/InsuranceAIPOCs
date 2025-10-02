import { Injectable } from '@nestjs/common';

@Injectable()
export class IoTIntegrationService {
  async fetchDeviceData(deviceId: string) {
    // Mock OBD-II device data for POC
    return {
      deviceId,
      timestamp: new Date(),
      metrics: {
        speed: Math.floor(Math.random() * 100),
        rpm: Math.floor(Math.random() * 5000),
        fuel: Math.floor(Math.random() * 100),
        engineTemp: 85 + Math.floor(Math.random() * 20),
        harshBraking: Math.floor(Math.random() * 5),
        harshAcceleration: Math.floor(Math.random() * 5),
        location: {
          lat: 35.6762 + (Math.random() - 0.5) * 0.1,
          lng: 139.6503 + (Math.random() - 0.5) * 0.1,
        },
      },
      status: 'active',
    };
  }
}