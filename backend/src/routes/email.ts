import { Router, Response } from 'express';
import { prisma } from '../index.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
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

    if (analysis.emailDraft) {
      return res.json({ emailDraft: analysis.emailDraft });
    }

    const transcript = await prisma.transcript.findUnique({
      where: { jobId: req.params.id },
      include: { speakers: true }
    });

    const speakers = transcript?.speakers || [];
    const speakerNames = speakers.map(s => s.name || 'Participante').filter(Boolean);
    const uniqueSpeakers = [...new Set(speakerNames)];

    const emailDraft = generateEmailDraft(analysis, uniqueSpeakers);

    await prisma.analysis.update({
      where: { jobId: req.params.id },
      data: { emailDraft }
    });

    res.json({ emailDraft });
  } catch (error) {
    console.error('Get email error:', error);
    res.status(500).json({ error: 'Failed to get email draft' });
  }
});

router.post('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { recipients, cc, subject, body } = req.body;

    const analysis = await prisma.analysis.findUnique({
      where: { jobId: req.params.id },
      include: { tasks: true, dates: true }
    });

    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const emailContent = {
      to: recipients,
      cc: cc || [],
      subject: subject || `Resumen de reunión - ${new Date().toLocaleDateString()}`,
      body: body || generateEmailDraft(analysis, [])
    };

    await prisma.analysis.update({
      where: { jobId: req.params.id },
      data: { emailDraft: JSON.stringify(emailContent) }
    });

    res.json({ emailContent, message: 'Email draft saved' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save email' });
  }
});

function generateEmailDraft(analysis: any, speakers: string[]): string {
  const speakerList = speakers.length > 0 ? speakers.join(', ') : '[ nombres de participantes ]';

  let draft = `Estimados/as,\n\n`;
  draft += `Adjunto el resumen de la reunión sostenida el ${new Date().toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric'
  })}.\n\n`;

  if (analysis.summary) {
    draft += `RESUMEN EJECUTIVO\n`;
    draft += `${analysis.summary}\n\n`;
  }

  if (analysis.decisions && analysis.decisions.length > 0) {
    draft += `DECISIONES TOMADAS\n`;
    analysis.decisions.forEach((d: string, i: number) => {
      draft += `${i + 1}. ${d}\n`;
    });
    draft += `\n`;
  }

  if (analysis.tasks && analysis.tasks.length > 0) {
    draft += `TAREAS Y RESPONSABLES\n`;
    analysis.tasks.forEach((t: any) => {
      draft += `- ${t.description}`;
      if (t.owner) draft += ` (Responsable: ${t.owner})`;
      if (t.dueDate) draft += ` - Fecha: ${new Date(t.dueDate).toLocaleDateString('es-ES')}`;
      draft += `\n`;
    });
    draft += `\n`;
  }

  if (analysis.dates && analysis.dates.length > 0) {
    draft += `PRÓXIMAS FECHAS\n`;
    analysis.dates.forEach((d: any) => {
      draft += `- ${new Date(d.date).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'long', year: 'numeric'
      })}: ${d.description || 'Fecha señalada'}\n`;
    });
    draft += `\n`;
  }

  draft += `Participantes: ${speakerList}\n\n`;
  draft += `Saludos cordiales,\n`;
  draft += `[Tu nombre]\n\n`;
  draft += `---\n`;
  draft += `Generado automáticamente por Transcribe AI`;

  return draft;
}

export default router;
