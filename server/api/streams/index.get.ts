import { defineEventHandler, createError } from 'h3';
import { natsService } from '../../utils/natsService';

export default defineEventHandler(async (event) => {
  try {
    const streams = await natsService.getStreams();
    return streams;
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch streams',
    });
  }
});