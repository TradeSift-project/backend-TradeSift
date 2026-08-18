import { setDefaultResultOrder } from 'dns';
setDefaultResultOrder('ipv4first');

import app from './app.js';
import { env } from './config/env.js';
import redis from './config/redis.js';
import prisma from '../prisma/client.js';
import ngrokUrl from '../ngrok.js';
import logger from './config/logger.js';
import { initProcessingWorker } from './modules/processing/processing.worker.js';
import { Worker } from 'bullmq';

let processingWorker: Worker;

const startServer = async () => {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    app.listen(env.PORT, () => {
      logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server running');
      
      // Initialize BullMQ processing worker
      processingWorker = initProcessingWorker();
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
// ngrokUrl()


process.on('SIGINT', async () => {
  if (processingWorker) await processingWorker.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (processingWorker) await processingWorker.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});
