import { defineEventHandler, readBody, createError } from 'h3';
import { natsService } from '../utils/natsService';
import { NatsConnectionDetails } from '~/types';

export default defineEventHandler(async (event) => {
  const body = await readBody<NatsConnectionDetails>(event);

  try {
    await natsService.connect(body);
    return { success: true };
  } catch (error: any) {
    throw createError({
      statusCode: 400,
      statusMessage: error.message || 'Failed to connect',
    });
  }
});