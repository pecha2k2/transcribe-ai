import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import fs from 'fs';
import path from 'path';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, status, type, search, tags, limit = 50, offset = 0 } = req.query;

    const where: any = { userId: req.userId };

    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (type) where.type = type;
    if (tags) where.tags = { hasSome: JSON.parse(tags as string) };

    if (search) {
      where.OR = [
        { fileName: { contains: search as string, mode: 'insensitive' } },
        { tags: { has: search as string } }
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
        skip: Number(offset)
      }),
      prisma.job.count({ where })
    ]);

    res.json({ jobs, total, limit: Number(limit), offset: Number(offset) });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        project: { select: { id: true, name: true } }
      }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get job' });
  }
});

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { tags, projectId, fileName } = req.body;

    const job = await prisma.job.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data: { tags, projectId, fileName }
    });

    if (job.count === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update job' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.fileUrl) {
      const filePath = path.join('/app/backend/uploads', job.fileUrl.replace('/uploads/', ''));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.job.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

router.get('/:id/download', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.fileUrl) {
      return res.status(404).json({ error: 'No file available' });
    }

    const filePath = path.join('/app/backend/uploads', job.fileUrl.replace('/uploads/', ''));
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileName = job.fileName || 'audio';
    res.download(filePath, fileName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

export default router;
