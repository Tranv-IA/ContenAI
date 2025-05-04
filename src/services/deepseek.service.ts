import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class DeepseekService {
  private readonly logger = new Logger(DeepseekService.name);
  private readonly apiKey = process.env.DEEPSEEK_API_KEY || 'tu-api-key-aquí';
  private readonly apiUrl = 'https://api.deepseek.com/v1/chat/completions';

  async generateCompletion(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'deepseek-chat',
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
      return response.data.choices[0].message.content;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error en DeepSeek API: ${errorMessage}`);
      return 'No se pudo generar la respuesta. Por favor, intenta nuevamente.';
    }
  }
}