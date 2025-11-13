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
    // Get stream info with subjects filter to retrieve all subjects and their counts
    const jsm = natsService['jsm'];
    if (!jsm) {
      throw new Error('Not connected to NATS');
    }

    const streamInfo = await jsm.streams.info(streamName, { subjects_filter: '>' });

    // Return subjects map
    return {
      subjects: streamInfo.state.subjects || {},
    };
  } catch (error: any) {
    console.error(`Failed to get subjects for stream ${streamName}:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch subjects',
    });
  }
});
