import { transcriptionQueue, analysisQueue } from './queue.js';
import { prisma } from '../utils/prisma.js';
import { transcribeAudio } from '../services/transcriptionService.js';
import { analyzeTranscript } from '../services/analysisService.js';

async function processTranscription(job: any) {
  const { jobId, filePath } = job.data;
  console.log(`[TRANSCRIPTION] Starting job ${jobId}`);

  const updateProgress = async (progress: number, forceStatus?: string) => {
    try {
      const data: any = { progress };
      if (forceStatus) {
        data.status = forceStatus;
      }
      await prisma.job.update({
        where: { id: jobId },
        data
      });
    } catch (e: any) {
      console.error(`[TRANSCRIPTION] Failed to update progress for job ${jobId}:`, e.message);
    }
  };

  try {
    await updateProgress(5, 'PROCESSING');
    console.log(`[TRANSCRIPTION] Calling transcribeAudio for job ${jobId}`);
    await transcribeAudio(filePath, jobId, updateProgress);
    console.log(`[TRANSCRIPTION] Transcription complete for job ${jobId}`);

    await updateProgress(100, 'COMPLETED');
    console.log(`[TRANSCRIPTION] Job ${jobId} transcription done, awaiting analysis trigger`);

  } catch (error: any) {
    console.error(`[TRANSCRIPTION] Error for job ${jobId}:`, error.message);
    let retryCount = 0;
    const maxRetries = 3;
    while (retryCount < maxRetries) {
      try {
        await prisma.job.update({
          where: { id: jobId },
          data: { status: 'FAILED', error: error.message }
        });
        break;
      } catch (e: any) {
        retryCount++;
        console.error(`[TRANSCRIPTION] Failed to update job to FAILED (attempt ${retryCount}/${maxRetries}):`, e.message);
        if (retryCount >= maxRetries) {
          console.error(`[TRANSCRIPTION] Job ${jobId} may be stuck in PROCESSING state`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    throw error;
  }
}

async function analyzeJob(jobId: string) {
  console.log(`[ANALYSIS] Starting job ${jobId}`);

  const updateProgress = async (progress: number) => {
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'PROCESSING', progress }
      });
    } catch (e: any) {
      console.error(`[ANALYSIS] Failed to update progress for job ${jobId}:`, e.message);
    }
  };

  try {
    await updateProgress(5);
    
    const analysisProgressCallback = (progress: number) => {
      updateProgress(progress);
    };
    
    const analysisResult = await analyzeTranscript(jobId, analysisProgressCallback);
    console.log(`[ANALYSIS] Got analysis result for job ${jobId}`);
    await updateProgress(80);

    const existingAnalysis = await prisma.analysis.findUnique({
      where: { jobId }
    });

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
            create: analysisResult.tasks.map((t: any) => ({
              description: t.description,
              owner: t.owner,
              priority: t.priority || 'MEDIUM',
              status: 'OPEN',
              dueDate: t.dueDate ? new Date(t.dueDate) : null
            }))
          },
          dates: {
            create: analysisResult.dates.map((d: any) => ({
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
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'COMPLETED' }
    });

    console.log(`[ANALYSIS] Job ${jobId} analysis complete`);

  } catch (error: any) {
    console.error(`[ANALYSIS] Error for job ${jobId}:`, error.message);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FAILED', error: error.message }
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

transcriptionQueue.process(async (job) => {
  console.log(`[QUEUE] Processing transcription job ${job.id}`);
  await processTranscription(job);
  console.log(`[QUEUE] Transcription job ${job.id} completed successfully`);
  return { success: true };
});

analysisQueue.process(async (job) => {
  console.log(`[QUEUE] Processing analysis job ${job.id}`);
  const { jobId } = job.data;
  await analyzeJob(jobId);
  console.log(`[QUEUE] Analysis job ${job.id} completed successfully`);
  return { success: true };
});

transcriptionQueue.on('completed', (job, result) => {
  console.log(`[QUEUE] Transcription job ${job.id} completed with result:`, result);
});

transcriptionQueue.on('failed', (job, err) => {
  console.error(`[QUEUE] Transcription job ${job.id} failed:`, err.message);
});

analysisQueue.on('completed', (job, result) => {
  console.log(`[QUEUE] Analysis job ${job.id} completed with result:`, result);
});

analysisQueue.on('failed', (job, err) => {
  console.error(`[QUEUE] Analysis job ${job.id} failed:`, err.message);
});

console.log('[WORKER] Workers started and listening for jobs...');
