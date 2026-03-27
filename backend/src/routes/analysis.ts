import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { addAnalysisJob } from '../workers/queue.js';

const router = Router();

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id },
      include: {
        tasks: true,
        dates: true
      }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    res.json(analysis);
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ error: 'Failed to get analysis' });
  }
});

router.post('/:id/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const existingAnalysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id }
    });

    if (existingAnalysis) {
      return res.json({ analysis: existingAnalysis, message: 'Analysis already exists' });
    }

    await addAnalysisJob(req.params.id);

    res.json({ jobId: req.params.id, message: 'Analysis job queued' });
  } catch (error) {
    console.error('Generate analysis error:', error);
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { summary, keyPoints, decisions, risks, openQuestions, mindmap, emailDraft } = req.body;

    const analysis = await prisma.analysis.update({
      where: { jobId: req.params.id },
      data: {
        summary,
        keyPoints,
        decisions,
        risks,
        openQuestions,
        mindmap,
        emailDraft
      }
    });

    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update analysis' });
  }
});

router.post('/:id/tasks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { description, owner, priority, dueDate } = req.body;

    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const task = await prisma.task.create({
      data: {
        analysisId: analysis.id,
        description,
        owner,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.patch('/tasks/:taskId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { description, owner, priority, status, dueDate } = req.body;

    const task = await prisma.task.update({
      where: { id: req.params.taskId },
      data: {
        description,
        owner,
        priority,
        status,
        dueDate: dueDate ? new Date(dueDate) : null
      }
    });

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

export default router;
