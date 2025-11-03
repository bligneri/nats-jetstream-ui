import { defineEventHandler, createError } from 'h3';
import { natsService } from '../../utils/natsService';

export default defineEventHandler(async (event) => {
  try {
    console.log('📡 API: Fetching streams...');
    const streams = await natsService.getStreams();
    console.log(`📡 API: Returning ${streams.length} streams`);
    return streams;
  } catch (error: any) {
    console.error('📡 API Error fetching streams:', error.message);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch streams',
    });
  }
});