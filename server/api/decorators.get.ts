import { defineEventHandler, getQuery } from 'h3';
import { readFile } from 'fs/promises';
import { join } from 'path';

export default defineEventHandler(async (event) => {
  try {
    const { serverId } = getQuery(event);

    // Read decorators config from root of project
    const configPath = join(process.cwd(), 'decorators.config.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    // If serverId is provided, return decorators for that specific server
    if (serverId) {
      const serverIdNum = parseInt(serverId as string, 10);
      const server = config.servers?.find((s: any) => s.id === serverIdNum);
      return server?.decorators || [];
    }

    // Legacy: return first server's decorators if no serverId specified
    return config.servers?.[0]?.decorators || config.decorators || [];
  } catch (error) {
    // If config doesn't exist, return empty array
    console.warn('No decorators.config.json found, using defaults');
    return [];
  }
});
