import { defineEventHandler } from 'h3';
import { readFile } from 'fs/promises';
import { join } from 'path';

export default defineEventHandler(async (event) => {
  try {
    // Read decorators config from root of project
    const configPath = join(process.cwd(), 'decorators.config.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    return config.decorators || [];
  } catch (error) {
    // If config doesn't exist, return empty array
    console.warn('No decorators.config.json found, using defaults');
    return [];
  }
});
