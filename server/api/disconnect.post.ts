import { defineEventHandler } from 'h3';
import { natsService } from '../utils/natsService';

export default defineEventHandler(async (event) => {
  try {
    await natsService.disconnect();
    return { success: true };
  } catch (error: any) {
    console.error('Error disconnecting:', error);
    return { success: false, error: error.message };
  }
});
