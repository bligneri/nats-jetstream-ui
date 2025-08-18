import { defineEventHandler, getRouterParam, createError } from 'h3';
import { natsService } from '../../../utils/natsService';

export default defineEventHandler(async (event) => {
  const streamName = getRouterParam(event, 'name');
  if (!streamName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Stream name is required',
    });
  }

  try {
    const consumers = await natsService.getConsumers(streamName as string);
    return consumers;
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || `Failed to fetch consumers for ${streamName}`,
    });
  }
});