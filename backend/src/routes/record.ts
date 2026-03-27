import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { addTranscriptionJob } from '../workers/queue.js';

const router = Router();

router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { filename, duration, projectId } = req.body;
    const audioData = req.body.audioData;

    if (!audioData) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    const fileName = `recording_${uuidv4()}.webm`;
    const filePath = `./uploads/${fileName}`;

    const buffer = Buffer.from(audioData, 'base64');
    const fs = await import('fs');
    fs.writeFileSync(filePath, buffer);

    const job = await prisma.job.create({
      data: {
        userId: req.userId!,
        projectId: projectId || null,
        type: 'RECORD',
        status: 'PROCESSING',
        fileName: filename || 'Recording',
        fileUrl: `/uploads/${fileName}`,
        mimeType: 'audio/webm',
        duration: duration || 0
      }
    });

    await addTranscriptionJob(job.id, filePath);

    res.json({ job });
  } catch (error) {
    console.error('Record error:', error);
    res.status(500).json({ error: 'Recording save failed' });
  }
});

export default router;
