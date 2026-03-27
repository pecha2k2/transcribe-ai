import Queue from 'bull';
import Redis from 'ioredis';
import 'dotenv/config';

const redisOptions = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined
  }
};

export const transcriptionQueue = new Queue('transcription', redisOptions);
export const analysisQueue = new Queue('analysis', redisOptions);

export async function addTranscriptionJob(jobId: string, filePath: string) {
  await transcriptionQueue.add({ jobId, filePath }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });
}

export async function addAnalysisJob(jobId: string) {
  await analysisQueue.add({ jobId }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 }
  });
}
