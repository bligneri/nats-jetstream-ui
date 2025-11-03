import { defineEventHandler, createError } from 'h3';
import { natsService } from '../utils/natsService';

export default defineEventHandler(async (event) => {
  const info = natsService.getConnectionInfo();

  if (!info) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not connected to NATS',
    });
  }

  return {
    serverUrl: info.serverUrl,
  };
});
