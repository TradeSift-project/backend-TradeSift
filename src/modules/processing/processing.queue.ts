// processing.queue.ts
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { OPERATION_PROCESSING_QUEUE } from './processing.constants.js';
import type { ProcessingJobData } from './processing.types.js';

// Upstash-friendly BullMQ connection config
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
});

export const processingQueue = new Queue<ProcessingJobData>(OPERATION_PROCESSING_QUEUE, {
  connection,
});

export const enqueueProcessingJob = async (jobData: ProcessingJobData) => {
  return processingQueue.add('process_documents', jobData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
};
