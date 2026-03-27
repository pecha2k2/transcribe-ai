import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import dotenv from 'dotenv';
import { prisma } from './utils/prisma.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import recordRoutes from './routes/record.js';
import jobRoutes from './routes/jobs.js';
import transcriptRoutes from './routes/transcript.js';
import analysisRoutes from './routes/analysis.js';
import exportRoutes from './routes/export.js';
import emailRoutes from './routes/email.js';
import projectRoutes from './routes/projects.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
export const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

export { prisma };

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/record', recordRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/transcript', transcriptRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/projects', projectRoutes);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-job', (jobId: string) => {
    socket.join(`job-${jobId}`);
  });

  socket.on('leave-job', (jobId: string) => {
    socket.leave(`job-${jobId}`);
  });
});

const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
