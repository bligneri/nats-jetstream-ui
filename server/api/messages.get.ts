import { defineEventHandler, getQuery, createError } from 'h3';
import { natsService } from '../utils/natsService';

export default defineEventHandler(async (event) => {
  const { subject, limit, offset, stream } = getQuery(event);

  if (!subject || typeof subject !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Subject query parameter is required',
    });
  }

  const limitNum = limit ? parseInt(limit as string, 10) : 50;
  const offsetNum = offset ? parseInt(offset as string, 10) : 0;
  const streamName = stream && typeof stream === 'string' ? stream : undefined;

  try {
    console.log(`📬 API: Fetching messages for subject="${subject}", stream="${streamName || 'auto'}", limit=${limitNum}, offset=${offsetNum}`);
    const messages = await natsService.getMessages(subject, limitNum, offsetNum, streamName);
    console.log(`📬 API: Returning ${messages.length} messages for subject="${subject}"`);
    return messages;
  } catch (error: any) {
    console.error(`📬 API Error fetching messages for "${subject}":`, error.message);
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch messages',
    });
  }
});