import { defineEventHandler } from 'h3';
import { natsService } from '../utils/natsService';

export default defineEventHandler(async (event) => {
  return {
    connected: natsService.isConnected(),
    hasConnectionDetails: natsService.hasConnectionDetails(),
  };
});
