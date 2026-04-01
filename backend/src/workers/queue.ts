import { Queue } from 'bullmq';
import 'dotenv/config';

export const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined
};

export const transcriptionQueue = new Queue('transcription', { connection: redisConnection });
export const analysisQueue = new Queue('analysis', { connection: redisConnection });

export async function addTranscriptionJob(jobId: string, filePath: string) {
  await transcriptionQueue.add('transcribe', { jobId, filePath }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });
}

export async function addAnalysisJob(jobId: string) {
  await analysisQueue.add('analyze', { jobId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });
}
