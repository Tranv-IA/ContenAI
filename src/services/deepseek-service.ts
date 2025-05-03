// src/services/deepseek.service.ts
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private readonly apiKey = process.env.DEEPSEEK_API_KEY || 'tu-api-key-aquí'; // Reemplaza con tu API key de DeepSeek
  private readonly apiUrl = 'https://api.deepseek.com/v1/chat/completions'; // URL de la API de DeepSeek

  async generateCompletion(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-chat', // Este es el nombre del modelo, ajusta según documentación DeepSeek
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        },
      );

      // Ajusta esto según la estructura de respuesta específica de DeepSeek
      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error(`Error en DeepSeek API: ${error.message}`);
      return 'No se pudo generar la respuesta. Por favor, intenta nuevamente.';
    }
  }
}