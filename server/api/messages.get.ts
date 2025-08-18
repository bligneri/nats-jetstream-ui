import { defineEventHandler, getQuery, createError } from 'h3';
import { natsService } from '../utils/natsService';

export default defineEventHandler(async (event) => {
  const { subject } = getQuery(event);

  if (!subject || typeof subject !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Subject query parameter is required',
    });
  }

  try {
    const messages = await natsService.getMessages(subject);
    return messages;
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch messages',
    });
  }
});