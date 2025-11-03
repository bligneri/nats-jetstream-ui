import { defineEventHandler } from 'h3';
import { readFileSync } from 'fs';
import { join } from 'path';

export default defineEventHandler(async (event) => {
  try {
    const configPath = join(process.cwd(), 'decorators.config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    return config;
  } catch (error: any) {
    console.error('Failed to load server config:', error);
    // Return default config if file doesn't exist
    return {
      servers: [
        {
          id: 1,
          name: 'Default',
          url: 'nats://localhost:4222',
          decorators: []
        }
      ]
    };
  }
});
