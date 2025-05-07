import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class CohereService {
  private readonly logger = new Logger(CohereService.name);
  private readonly apiKey = process.env.COHERE_API_KEY || 'your-api-key';
  private readonly apiUrl = 'https://api.cohere.ai/v1/generate';

  async generateCompletion(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'command',
          prompt: prompt,
          max_tokens: 1000,
          temperature: 0.7,
          k: 0,
          stop_sequences: [],
          return_likelihoods: 'NONE'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'Cohere-Version': '2022-12-06'
          },
        },
      );
      return response.data.generations[0].text;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error en Cohere API: ${errorMessage}`);
      return 'No se pudo generar la respuesta. Por favor, intenta nuevamente.';
    }
  }

  async classifyTrends(inputs: string[], examples: Array<{text: string, label: string}>): Promise<{classifications: Array<{prediction: string, confidence: number}>}> {
    try {
      const response = await axios.post(
        'https://api.cohere.ai/v1/classify',
        {
          inputs,
          examples,
          model: 'large',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'Cohere-Version': '2022-12-06'
          },
        }
      );
      return response.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error en Cohere Classify API: ${errorMessage}`);
      throw new Error('No se pudo clasificar las tendencias. Por favor, intenta nuevamente.');
    }
  }
}