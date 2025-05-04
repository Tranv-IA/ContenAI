// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TrendsController } from './controllers/trends.controller';
import { TrendsService } from './services/trends.service';
import { DeepseekService } from './services/deepseek.service';

@Module({
  imports: [],
  controllers: [AppController, TrendsController],
  providers: [AppService, TrendsService, DeepseekService],
})
export class AppModule {}