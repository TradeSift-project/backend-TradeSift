// processing.worker.ts
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import { OPERATION_PROCESSING_QUEUE } from './processing.constants.js';
import type { ProcessingJobData } from './processing.types.js';
import { executeProcessingJob, updateJobStatus } from './processing.service.js';

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  keepAlive: 10000,
});

export const initProcessingWorker = () => {
  const worker = new Worker<ProcessingJobData>(
    OPERATION_PROCESSING_QUEUE,
    async (job: Job<ProcessingJobData>) => {
      const { jobId, operationId, userId } = job.data;
      
      logger.info({ jobId, operationId }, 'Processing job started');

      try {
        await executeProcessingJob(userId, jobId);
        logger.info({ jobId, operationId }, 'Processing job completed successfully');
      } catch (error: any) {
        logger.error({ err: error, jobId, operationId }, 'Processing job failed');
        
        await updateJobStatus(userId, jobId, {
          status: 'FAILED',
          failedAt: new Date(),
          errorMessage: error.message || 'Unknown error occurred during processing',
        });
        
        throw error; // Let BullMQ handle retries
      }
    },
    {
      connection,
      concurrency: 5, // Process up to 5 jobs concurrently
    }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'BullMQ Job Failed');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'BullMQ Worker Error');
  });

  logger.info('Processing worker initialized');
  return worker;
};
