import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { addTranscriptionJob } from '../workers/queue.js';

const router = Router();

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/m4a', 'video/mp4', 'audio/mp3'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

router.post('/', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { projectId, tags } = req.body;

    const job = await prisma.job.create({
      data: {
        userId: req.userId!,
        projectId: projectId || null,
        type: 'UPLOAD',
        status: 'PROCESSING',
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        mimeType: req.file.mimetype,
        tags: tags ? JSON.parse(tags) : []
      }
    });

    await addTranscriptionJob(job.id, req.file.path);

    res.json({ job });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

router.get('/presigned', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { filename, contentType } = req.query;

    const presignedUrl = `https://transcribeai-uploads.s3.amazonaws.com/${filename}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600`;

    res.json({ uploadUrl: presignedUrl, fileKey: filename });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate presigned URL' });
  }
});

export default router;
