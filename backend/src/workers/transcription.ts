import fs from 'fs';
import { Worker, Job } from 'bullmq';
import { JobStatus, Priority, TaskStatus } from '@prisma/client';
import { redisConnection } from './queue.js';
import { prisma } from '../utils/prisma.js';
import { transcribeAudio } from '../services/transcriptionService.js';
import { analyzeTranscript } from '../services/analysisService.js';

interface TranscriptionJobData {
  jobId: string;
  filePath: string;
}

interface AnalysisJobData {
  jobId: string;
}

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
    console.log(`[WORKER] Deleted uploaded file: ${filePath}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[WORKER] Could not delete file ${filePath}: ${msg}`);
  }
}

async function processTranscription(job: Job<TranscriptionJobData>): Promise<void> {
  const { jobId, filePath } = job.data;
  console.log(`[TRANSCRIPTION] Starting job ${jobId}`);

  const updateProgress = async (progress: number, forceStatus?: JobStatus): Promise<void> => {
    try {
      const data: { progress: number; status?: JobStatus } = { progress };
      if (forceStatus) data.status = forceStatus;
      await prisma.job.update({ where: { id: jobId }, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[TRANSCRIPTION] Failed to update progress for job ${jobId}:`, msg);
    }
  };

  try {
    await updateProgress(5, JobStatus.PROCESSING);
    await transcribeAudio(filePath, jobId, updateProgress);
    console.log(`[TRANSCRIPTION] Transcription complete for job ${jobId}`);
    await updateProgress(100, JobStatus.COMPLETED);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[TRANSCRIPTION] Error for job ${jobId}:`, msg);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.FAILED, error: msg }
    });
    throw error;
  } finally {
    await cleanupFile(filePath);
  }
}

async function processAnalysis(job: Job<AnalysisJobData>): Promise<void> {
  const { jobId } = job.data;
  console.log(`[ANALYSIS] Starting job ${jobId}`);

  const updateProgress = async (progress: number): Promise<void> => {
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: JobStatus.PROCESSING, progress }
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ANALYSIS] Failed to update progress for job ${jobId}:`, msg);
    }
  };

  try {
    await updateProgress(5);
    const analysisResult = await analyzeTranscript(jobId, updateProgress);
    console.log(`[ANALYSIS] Got analysis result for job ${jobId}`);
    await updateProgress(80);

    const existingAnalysis = await prisma.analysis.findUnique({ where: { jobId } });

    if (!existingAnalysis) {
      await updateProgress(90);
      await prisma.analysis.create({
        data: {
          jobId,
          summary: analysisResult.summary,
          keyPoints: analysisResult.keyPoints,
          decisions: analysisResult.decisions,
          risks: analysisResult.risks,
          openQuestions: analysisResult.openQuestions,
          tasks: {
            create: analysisResult.tasks.map((t) => ({
              description: t.description,
              owner: t.owner,
              priority: (t.priority as Priority) || Priority.MEDIUM,
              status: TaskStatus.OPEN,
              dueDate: t.dueDate ? new Date(t.dueDate) : null
            }))
          },
          dates: {
            create: analysisResult.dates.map((d) => ({
              date: new Date(d.date),
              description: d.description
            }))
          },
          mindmap: analysisResult.mindmap
        }
      });
      console.log(`[ANALYSIS] Analysis created for job ${jobId}`);
    }

    await updateProgress(100);
    await prisma.job.update({ where: { id: jobId }, data: { status: JobStatus.COMPLETED } });
    console.log(`[ANALYSIS] Job ${jobId} analysis complete`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ANALYSIS] Error for job ${jobId}:`, msg);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.FAILED, error: msg }
    });
    throw error;
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WORKER] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[WORKER] Uncaught Exception:', error);
  process.exit(1);
});

const transcriptionWorker = new Worker<TranscriptionJobData>(
  'transcription',
  async (job) => {
    console.log(`[QUEUE] Processing transcription job ${job.id}`);
    await processTranscription(job);
    console.log(`[QUEUE] Transcription job ${job.id} completed successfully`);
    return { success: true };
  },
  { connection: redisConnection }
);

const analysisWorker = new Worker<AnalysisJobData>(
  'analysis',
  async (job) => {
    console.log(`[QUEUE] Processing analysis job ${job.id}`);
    await processAnalysis(job);
    console.log(`[QUEUE] Analysis job ${job.id} completed successfully`);
    return { success: true };
  },
  { connection: redisConnection }
);

transcriptionWorker.on('completed', (job) => {
  console.log(`[QUEUE] Transcription job ${job.id} completed`);
});

transcriptionWorker.on('failed', (job, err) => {
  console.error(`[QUEUE] Transcription job ${job?.id} failed:`, err.message);
});

analysisWorker.on('completed', (job) => {
  console.log(`[QUEUE] Analysis job ${job.id} completed`);
});

analysisWorker.on('failed', (job, err) => {
  console.error(`[QUEUE] Analysis job ${job?.id} failed:`, err.message);
});

console.log('[WORKER] Workers started and listening for jobs...');
