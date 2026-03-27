import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { generateMindmapFromTranscript } from '../services/analysisService.js';
import { prisma } from '../utils/prisma.js';
const router = Router();

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const transcript = await prisma.transcript.findUnique({
      where: { jobId: req.params.id },
      include: {
        speakers: true,
        text: { orderBy: { start: 'asc' } }
      }
    });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    res.json(transcript);
  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({ error: 'Failed to get transcript' });
  }
});

router.patch('/:id/segments/:segmentId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { content, start, end, speakerId } = req.body;

    const segment = await prisma.textSegment.update({
      where: { id: req.params.segmentId },
      data: { content, start, end, speakerId }
    });

    const transcript = await prisma.transcript.findUnique({
      where: { id: segment.transcriptId },
      include: { speakers: true }
    });

    if (transcript) {
      const analysis = await prisma.analysis.findUnique({
        where: { jobId: transcript.jobId }
      });

      if (analysis) {
        const fullTranscript = await prisma.transcript.findUnique({
          where: { id: segment.transcriptId },
          include: { speakers: true, text: { orderBy: { start: 'asc' } } }
        });

        if (fullTranscript) {
          const newMindmap = generateMindmapFromTranscript(fullTranscript, analysis);
          await prisma.analysis.update({
            where: { jobId: transcript.jobId },
            data: { mindmap: newMindmap }
          });
        }
      }
    }

    res.json(segment);
  } catch (error) {
    console.error('Update segment error:', error);
    res.status(500).json({ error: 'Failed to update segment' });
  }
});

router.put('/:id/segments', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { segments } = req.body;

    const transcript = await prisma.transcript.findUnique({
      where: { jobId: req.params.id }
    });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    const updatedSegments = [];
    for (const seg of segments) {
      const updated = await prisma.textSegment.update({
        where: { id: seg.id },
        data: {
          content: seg.content,
          start: seg.start,
          end: seg.end,
          speakerId: seg.speakerId
        }
      });
      updatedSegments.push(updated);
    }

    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id }
    });

    if (analysis) {
      const fullTranscript = await prisma.transcript.findUnique({
        where: { jobId: req.params.id },
        include: { speakers: true, text: { orderBy: { start: 'asc' } } }
      });

      if (fullTranscript) {
        const newMindmap = generateMindmapFromTranscript(fullTranscript, analysis);
        await prisma.analysis.update({
          where: { jobId: req.params.id },
          data: { mindmap: newMindmap }
        });
      }
    }

    res.json({ success: true, segments: updatedSegments });
  } catch (error) {
    console.error('Update segments error:', error);
    res.status(500).json({ error: 'Failed to update segments' });
  }
});

router.post('/:id/diarize', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { speakerMappings } = req.body;

    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const transcript = await prisma.transcript.findUnique({
      where: { jobId: req.params.id }
    });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    const updatedSpeakers: any[] = [];

    if (speakerMappings && Array.isArray(speakerMappings)) {
      for (const mapping of speakerMappings) {
        const speaker = await prisma.speaker.findFirst({
          where: { id: mapping.speakerId, transcriptId: transcript.id }
        });
        
        if (speaker) {
          const updated = await prisma.speaker.update({
            where: { id: mapping.speakerId },
            data: { name: mapping.name, role: mapping.role }
          });
          updatedSpeakers.push(updated);
        }
      }
    }

    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id }
    });

    if (analysis) {
      const fullTranscript = await prisma.transcript.findUnique({
        where: { jobId: req.params.id },
        include: { speakers: true, text: { orderBy: { start: 'asc' } } }
      });

      if (fullTranscript) {
        const newMindmap = generateMindmapFromTranscript(fullTranscript, analysis);
        
        await prisma.analysis.update({
          where: { jobId: req.params.id },
          data: { mindmap: newMindmap }
        });
      }
    }

    res.json({ success: true, speakers: updatedSpeakers });
  } catch (error) {
    console.error('Diarize error:', error);
    res.status(500).json({ error: 'Failed to update speakers' });
  }
});

router.patch('/speakers/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, role } = req.body;

    const speaker = await prisma.speaker.update({
      where: { id: req.params.id },
      data: { name, role }
    });

    const transcript = await prisma.transcript.findUnique({
      where: { id: speaker.transcriptId },
      include: { speakers: true }
    });

    if (transcript) {
      const analysis = await prisma.analysis.findUnique({
        where: { jobId: transcript.jobId }
      });

      if (analysis) {
        const fullTranscript = await prisma.transcript.findUnique({
          where: { id: speaker.transcriptId },
          include: { speakers: true, text: { orderBy: { start: 'asc' } } }
        });

        if (fullTranscript) {
          const newMindmap = generateMindmapFromTranscript(fullTranscript, analysis);
          
          await prisma.analysis.update({
            where: { jobId: transcript.jobId },
            data: { mindmap: newMindmap }
          });
        }
      }
    }

    res.json(speaker);
  } catch (error) {
    console.error('Update speaker error:', error);
    res.status(500).json({ error: 'Failed to update speaker' });
  }
});

export default router;
