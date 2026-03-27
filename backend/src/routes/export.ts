import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { exportToTxt, generateCalendar } from '../services/exportService.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import PDFDocument from 'pdfkit';
import { prisma } from '../utils/prisma.js';
const router = Router();

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { format = 'md' } = req.query;

    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { project: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const transcript = await prisma.transcript.findUnique({
      where: { jobId: req.params.id },
      include: { speakers: true, text: { orderBy: { start: 'asc' } } }
    });

    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id },
      include: { tasks: true, dates: true }
    });

    if (format === 'txt') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(job.fileName || 'file')}_transcript.txt"`);
      res.send(exportToTxt(transcript, analysis, job));
    } else {
      const markdown = generateMarkdown(job, transcript, analysis);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(job.fileName || 'file')}_report.md"`);
      res.send(markdown);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/:id/preview', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { project: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const transcript = await prisma.transcript.findUnique({
      where: { jobId: req.params.id },
      include: { speakers: true, text: { orderBy: { start: 'asc' } } }
    });

    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id },
      include: { tasks: true, dates: true }
    });

    const markdown = generateMarkdown(job, transcript, analysis);
    res.json({ markdown });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Preview failed' });
  }
});

router.get('/:id/calendar', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id },
      include: { dates: true }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    const ics = generateCalendar(analysis.dates, job?.fileName || 'Meeting');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(job?.fileName || 'meeting')}_dates.ics"`);
    res.send(ics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export calendar' });
  }
});

router.get('/:id/pdf', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { project: true }
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const transcript = await prisma.transcript.findUnique({
      where: { jobId: req.params.id },
      include: { speakers: true, text: { orderBy: { start: 'asc' } } }
    });

    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id },
      include: { tasks: true, dates: true }
    });

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: `Transcribe AI - ${job.fileName || 'Meeting Report'}`,
        Author: 'Transcribe AI',
        Subject: 'Meeting Transcription and Analysis'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${sanitizeFilename(job.fileName || 'report')}.pdf"`);

    doc.pipe(res);

    doc.fontSize(22).font('Helvetica-Bold').text('Transcribe AI', { align: 'center' });
    doc.fontSize(14).font('Helvetica').text('Meeting Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Oblique').text(`Generated: ${new Date().toLocaleString('es-ES')}`, { align: 'center' });
    doc.moveDown(2);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(14).font('Helvetica-Bold').text('Meeting Information', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`File: ${job.fileName || 'N/A'}`);
    doc.text(`Type: ${job.type || 'N/A'}`);
    doc.text(`Date: ${new Date(job.createdAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
    doc.text(`Job ID: ${job.id}`);
    doc.moveDown();

    if (transcript?.speakers?.length) {
      doc.fontSize(12).font('Helvetica-Bold').text('Participants:', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      transcript.speakers.forEach((speaker: any) => {
        const role = speaker.role ? ` (${speaker.role})` : '';
        doc.text(`- ${speaker.name || 'Unknown Participant'}${role}`);
      });
      doc.moveDown();
      doc.text(`Duration: ${transcript.duration ? formatDuration(transcript.duration) : 'N/A'}`);
      doc.text(`Language: ${transcript.language?.toUpperCase() || 'N/A'}`);
      doc.text(`Total Segments: ${transcript.text?.length || 0}`);
      doc.moveDown();
    }

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    if (transcript?.text?.length) {
      if (doc.y > 600) doc.addPage();

      doc.fontSize(14).font('Helvetica-Bold').text('Full Transcript', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(9).font('Helvetica-Oblique').text('Detailed transcription with speaker identification and timestamps.');
      doc.moveDown(0.5);

      let currentSpeaker = '';
      transcript.text.forEach((seg: any) => {
        if (doc.y > 700) doc.addPage();

        const speaker = transcript.speakers?.find((s: any) => s.id === seg.speakerId);
        const speakerName = speaker?.name || 'Unknown';
        const speakerRole = speaker?.role ? ` (${speaker.role})` : '';

        if (speakerName !== currentSpeaker) {
          doc.moveDown(0.5);
          doc.font('Helvetica-Bold').fontSize(10).text(speakerName + speakerRole, { continued: false });
          doc.font('Helvetica').fontSize(9);
          currentSpeaker = speakerName;
        }

        const time = formatTime(seg.start);
        const content = (seg.content || '').substring(0, 150);
        doc.text(`[${time}] ${content}`);
      });
      doc.moveDown();
    }

    if (analysis) {
      if (doc.y > 500) doc.addPage();

      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(14).font('Helvetica-Bold').text('AI Analysis', { underline: true });
      doc.moveDown(0.5);

      if (analysis.summary) {
        doc.fontSize(11).font('Helvetica-Bold').text('Summary');
        doc.fontSize(10).font('Helvetica').text(analysis.summary);
        doc.moveDown();
      }

      if (analysis.keyPoints?.length) {
        doc.fontSize(11).font('Helvetica-Bold').text('Key Points');
        doc.fontSize(10).font('Helvetica');
        analysis.keyPoints.forEach((point: string, idx: number) => {
          doc.text(`${idx + 1}. ${point}`);
        });
        doc.moveDown();
      }

      if (analysis.decisions?.length) {
        doc.fontSize(11).font('Helvetica-Bold').text('Decisions Made');
        doc.fontSize(10).font('Helvetica');
        analysis.decisions.forEach((decision: string, idx: number) => {
          doc.text(`${idx + 1}. ${decision}`);
        });
        doc.moveDown();
      }

      if (analysis.risks?.length) {
        doc.fontSize(11).font('Helvetica-Bold').text('Risks Identified');
        doc.fontSize(10).font('Helvetica');
        analysis.risks.forEach((risk: string, idx: number) => {
          doc.text(`${idx + 1}. ${risk}`);
        });
        doc.moveDown();
      }

      if (analysis.openQuestions?.length) {
        doc.fontSize(11).font('Helvetica-Bold').text('Open Questions');
        doc.fontSize(10).font('Helvetica');
        analysis.openQuestions.forEach((question: string, idx: number) => {
          doc.text(`${idx + 1}. ${question}`);
        });
        doc.moveDown();
      }

      if (analysis.tasks?.length) {
        doc.fontSize(11).font('Helvetica-Bold').text('Actionable Tasks');
        doc.fontSize(9).font('Helvetica');
        analysis.tasks.forEach((task: any, idx: number) => {
          const priority = task.priority === 'HIGH' ? '[HIGH]' : task.priority === 'MEDIUM' ? '[MED]' : '[LOW]';
          const owner = task.owner || 'Unassigned';
          doc.text(`${idx + 1}. ${priority} ${task.description} | Owner: ${owner}`);
        });
        doc.moveDown();
      }

      if (analysis.dates?.length) {
        doc.fontSize(11).font('Helvetica-Bold').text('Important Dates');
        doc.fontSize(10).font('Helvetica');
        analysis.dates.forEach((dateItem: any, idx: number) => {
          const dateStr = new Date(dateItem.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          doc.text(`${idx + 1}. ${dateStr}: ${dateItem.description}`);
        });
        doc.moveDown();
      }

      if (analysis.mindmap) {
        if (doc.y > 400) doc.addPage();
        doc.fontSize(11).font('Helvetica-Bold').text('Mind Map');
        doc.moveDown(0.5);
        doc.fontSize(8).font('Helvetica-Oblique').text('(Mermaid diagram - see markdown export for visual representation)');
        doc.moveDown();
      }
    }

    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(10).font('Helvetica-Bold').text('Metadata', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');
    if (analysis) {
      doc.text(`Analysis ID: ${analysis.id || 'N/A'}`);
    }
    doc.text('Generated by: Transcribe AI');
    doc.text('AI Model: DeepSeek');
    doc.text('Report Version: 1.0');

    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica-Oblique').text('This report was automatically generated by Transcribe AI using advanced speech recognition and AI analysis.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

router.get('/:id/mindmap', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { format = 'mmd' } = req.query;

    const job = await prisma.job.findFirst({
      where: { id: req.params.id, userId: req.userId }
    });

    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id }
    });

    if (!analysis || !analysis.mindmap) {
      return res.status(404).json({ error: 'Mindmap not found' });
    }

    if (format === 'png') {
      const tempDir = '/tmp/mermaid';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const timestamp = Date.now();
      const mmdFile = path.join(tempDir, `diagram_${timestamp}.mmd`);

      fs.writeFileSync(mmdFile, analysis.mindmap);

      try {
        const mmdcPath = '/app/node_modules/.bin/mmdc';
        const pngFile = path.join(tempDir, `diagram_${timestamp}.png`);
        
        execSync(`"${mmdcPath}" -i "${mmdFile}" -o "${pngFile}" -b white -w 1920 -H 1080 --skip-http`, {
          stdio: 'pipe',
          timeout: 120000,
          env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium-browser', CHROME_PATH: '/usr/bin/chromium-browser' }
        });

        if (fs.existsSync(pngFile) && fs.statSync(pngFile).size > 0) {
          const imgBuffer = fs.readFileSync(pngFile);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Disposition', `attachment; filename="${job?.fileName || 'mindmap'}.png"`);
          try { fs.unlinkSync(mmdFile); } catch {}
          try { fs.unlinkSync(pngFile); } catch {}
          return res.send(imgBuffer);
        }
      } catch (err) {
        console.error('Mermaid CLI error:', err);
      }

      try {
        const encodedMmd = Buffer.from(analysis.mindmap).toString('base64');
        const url = `https://mermaid.ink/img/${encodedMmd}`;
        const imgBuffer = await downloadImage(url);
        if (imgBuffer) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Content-Disposition', `attachment; filename="${job?.fileName || 'mindmap'}.png"`);
          return res.send(imgBuffer);
        }
      } catch (err) {
        console.error('Mermaid.ink API error:', err);
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${job?.fileName || 'mindmap'}.mmd"`);
      return res.send(analysis.mindmap);
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${job?.fileName || 'mindmap'}.mmd"`);
    res.send(analysis.mindmap);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export mindmap' });
  }
});

function generateMarkdown(job: any, transcript: any, analysis: any): string {
  let md = '';

  md += '# 📋 Transcribe AI - Complete Meeting Report\n\n';
  md += `> **Generated:** ${new Date().toLocaleString('es-ES', { dateStyle: 'full', timeStyle: 'short' })}\n\n`;
  md += `---\n\n`;

  md += `## 📁 File Information\n\n`;
  md += `| Property | Value |\n`;
  md += `|:-------|:------|\n`;
  md += `| **File Name** | ${(job.fileName || 'N/A').replace(/\|/g, '\\|')} |\n`;
  md += `| **Type** | ${job.type || 'N/A'} |\n`;
  md += `| **Date** | ${new Date(job.createdAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} |\n`;
  md += `| **Job ID** | \`${job.id}\` |\n`;

  if (transcript?.speakers?.length) {
    md += `\n### 👥 Participants\n\n`;
    transcript.speakers.forEach((speaker: any) => {
      const role = speaker.role ? ` *( ${speaker.role} )*` : '';
      md += `- **${speaker.name || 'Unknown Participant'}**${role}\n`;
    });
    md += `\n| **Duration** | ${formatDuration(transcript.duration)} |\n`;
    md += `| **Language** | ${transcript.language?.toUpperCase() || 'N/A'} |\n`;
    md += `| **Total Segments** | ${transcript.text?.length || 0} |\n`;
  }

  md += `\n---\n\n`;

  if (transcript?.text?.length) {
    md += `## 📝 Full Transcript\n\n`;
    md += `> Detailed transcription with speaker identification and timestamps.\n\n`;
    
    let currentSpeaker = '';
    transcript.text.forEach((seg: any, idx: number) => {
      const speaker = transcript.speakers?.find((s: any) => s.id === seg.speakerId);
      const speakerName = speaker?.name || 'Unknown';
      const speakerRole = speaker?.role ? ` (${speaker.role})` : '';
      const time = formatTime(seg.start);
      const content = (seg.content || '').replace(/\n/g, ' ').substring(0, 200);
      
      if (speakerName !== currentSpeaker) {
        md += `\n**${speakerName}**${speakerRole}\n\n`;
        currentSpeaker = speakerName;
      }
      
      md += `[${time}] ${content}\n`;
    });
    md += `\n---\n\n`;
  }

  if (analysis) {
    md += `## 📊 AI Analysis\n\n`;
    md += `${analysis.summary || 'No summary available.'}\n\n`;

    if (analysis.keyPoints?.length) {
      md += `### 🎯 Key Points\n\n`;
      analysis.keyPoints.forEach((point: string, idx: number) => {
        md += `${idx + 1}. ${point}\n`;
      });
      md += `\n`;
    }

    if (analysis.decisions?.length) {
      md += `### ✅ Decisions Made\n\n`;
      analysis.decisions.forEach((decision: string, idx: number) => {
        md += `${idx + 1}. ${decision}\n`;
      });
      md += `\n`;
    }

    if (analysis.risks?.length) {
      md += `### ⚠️ Risks Identified\n\n`;
      analysis.risks.forEach((risk: string, idx: number) => {
        md += `${idx + 1}. ${risk}\n`;
      });
      md += `\n`;
    }

    if (analysis.openQuestions?.length) {
      md += `### ❓ Open Questions\n\n`;
      analysis.openQuestions.forEach((question: string, idx: number) => {
        md += `${idx + 1}. ${question}\n`;
      });
      md += `\n`;
    }

    if (analysis.tasks?.length) {
      md += `### 📋 Actionable Tasks\n\n`;
      md += `| # | Description | Owner | Priority | Due Date | Status |\n`;
      md += `|:---|:-----------|:------|:---------|:---------|:-------|\n`;
      analysis.tasks.forEach((task: any, idx: number) => {
        const description = (task.description || 'No description').replace(/\|/g, '\\|').substring(0, 50);
        const owner = (task.owner || 'Unassigned').substring(0, 15);
        const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-';
        const priority = task.priority === 'HIGH' ? '🔴 High' : task.priority === 'MEDIUM' ? '🟡 Medium' : '🟢 Low';
        const status = task.status || 'OPEN';
        md += `| ${idx + 1} | ${description} | ${owner} | ${priority} | ${dueDate} | ${status} |\n`;
      });
      md += `\n`;
    }

    if (analysis.dates?.length) {
      md += `### 📅 Important Dates\n\n`;
      analysis.dates.forEach((dateItem: any, idx: number) => {
        const dateStr = new Date(dateItem.date).toLocaleDateString('es-ES', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
        md += `${idx + 1}. **${dateStr}**\n`;
        if (dateItem.description) {
          md += `   > ${dateItem.description}\n`;
        }
      });
      md += `\n`;
    }

    if (analysis.mindmap) {
      md += `## 🧠 Mind Map\n\n`;
      md += `\`\`\`mermaid\n`;
      md += analysis.mindmap + '\n';
      md += `\`\`\`\n\n`;
      md += `> Visual representation of the meeting structure and key topics.\n\n`;
    }

    md += `---\n\n`;
    md += `## 📌 Metadata\n\n`;
    md += `- **Analysis ID:** \`${analysis.id || 'N/A'}\`\n`;
    md += `- **Generated by:** Transcribe AI\n`;
    md += `- **AI Model:** DeepSeek\n`;
    md += `- **Report Version:** 1.0\n\n`;
    md += `---\n\n`;
    md += `*This report was automatically generated by Transcribe AI using advanced speech recognition and AI analysis.*\n`;
  }

  return md;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function sanitizeFilename(filename: string): string {
  return filename?.replace(/[^a-z0-9]/gi, '_') || 'file';
}

function downloadImage(url: string): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      } else {
        resolve(null);
      }
    }).on('error', reject);
  });
}

export default router;
