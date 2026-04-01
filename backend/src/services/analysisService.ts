import { prisma } from '../utils/prisma.js';

interface AnalysisResult {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  risks: string[];
  openQuestions: string[];
  tasks: Array<{
    description: string;
    owner?: string;
    priority: string;
    dueDate?: string;
  }>;
  dates: Array<{
    date: string;
    description: string;
  }>;
  mindmap: string;
}

export async function analyzeTranscript(jobId: string, onProgress?: (p: number) => void): Promise<AnalysisResult> {
  const transcript = await prisma.transcript.findUnique({
    where: { jobId },
    include: { text: { orderBy: { start: 'asc' } }, speakers: true }
  });

  if (!transcript) {
    throw new Error('Transcript not found');
  }

  const fullText = transcript.text.map(t => t.content).join(' ');
  const speakers = transcript.speakers;

  onProgress?.(10);

  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const apiKey = deepseekApiKey || openaiApiKey;
  
  if (!apiKey) {
    onProgress?.(50);
    return generateBasicAnalysis(fullText, speakers);
  }

  const useDeepSeek = !!deepseekApiKey;
  const model = useDeepSeek ? 'deepseek-chat' : 'gpt-4o-mini';
  const baseURL = useDeepSeek ? 'https://api.deepseek.com' : 'https://api.openai.com/v1';
  onProgress?.(20);
  
  let response: Response;
  try {
    const prompt = `Analiza la siguiente transcripción de una reunión y extrae información estructurada. 
Devuelve SOLO un JSON válido con esta estructura exacta, sin texto adicional.
Usa oraciones completas y descriptivas, mínimo 50 caracteres por elemento:

{
  "summary": "Resumen detallado de la reunión en 3-4 oraciones completas en español (mínimo 100 caracteres)",
  "keyPoints": ["punto clave 1 completo en español (mínimo 50 caracteres)", "punto clave 2 completo en español (mínimo 50 caracteres)", "punto clave 3 completo en español (mínimo 50 caracteres)", "punto clave 4 en español", "punto clave 5 en español"],
  "decisions": ["decisión 1 completa y descriptiva en español (mínimo 50 caracteres)", "decisión 2 completa en español (mínimo 50 caracteres)", "decisión 3 en español"],
  "risks": ["riesgo 1 descriptivo en español (mínimo 40 caracteres)", "riesgo 2 descriptivo en español (mínimo 40 caracteres)"],
  "openQuestions": ["pregunta abierta 1 en español", "pregunta abierta 2 en español"],
  "tasks": [{"description": "tarea 1 detallada en español (mínimo 40 caracteres)", "priority": "HIGH"}, {"description": "tarea 2 detallada en español (mínimo 40 caracteres)", "priority": "MEDIUM"}],
  "dates": [{"date": "YYYY-MM-DD", "description": "descripción de la fecha en español"}]
}

Transcripción:
${fullText}`;

    console.log(`Calling ${useDeepSeek ? 'DeepSeek' : 'OpenAI'} API at ${baseURL}...`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente de IA especializado en análisis de reuniones en español. Analizas transcripciones y devuelves JSON estructurado.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    console.log(`${useDeepSeek ? 'DeepSeek' : 'OpenAI'} response status:`, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    
    console.log(`${useDeepSeek ? 'DeepSeek' : 'OpenAI'} response content length:`, content?.length || 0);
    
    if (!content) {
      throw new Error('No response from AI');
    }

    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse JSON from response');
      }
    }
    
    onProgress?.(70);
    const mindmap = generateMindmapFromAnalysis(analysis);
    onProgress?.(80);

    return {
      summary: analysis.summary || 'Resumen no disponible',
      keyPoints: analysis.keyPoints || [],
      decisions: analysis.decisions || [],
      risks: analysis.risks || [],
      openQuestions: analysis.openQuestions || [],
      tasks: (analysis.tasks || []).map((t: Record<string, string | undefined>) => ({
        description: t.description || t.descripcion || '',
        owner: t.owner || t.asignado || undefined,
        priority: t.priority || t.prioridad || 'MEDIUM',
        dueDate: t.dueDate || t.fechaLimite || undefined
      })),
      dates: (analysis.dates || []).map((d: Record<string, string | undefined>) => ({
        date: d.date || d.fecha || '',
        description: d.description || d.descripcion || ''
      })),
      mindmap
    };
  } catch (error) {
    console.error(`${useDeepSeek ? 'DeepSeek' : 'OpenAI'} analysis error:`, error);
    return generateBasicAnalysis(fullText, speakers);
  }
}

function generateMindmapFromAnalysis(analysis: AnalysisResult): string {
  const lines: string[] = ['mindmap', '  root((Meeting))'];
  
  if (analysis.summary) {
    lines.push(`    Summary`);
    lines.push(`      ${escapeMermaid(analysis.summary)}`);
  }
  
  if (analysis.keyPoints && analysis.keyPoints.length > 0) {
    lines.push(`    Key Points`);
    analysis.keyPoints.forEach((kp: string) => {
      lines.push(`      ${escapeMermaid(kp)}`);
    });
  }

  if (analysis.decisions && analysis.decisions.length > 0) {
    lines.push(`    Decisions`);
    analysis.decisions.forEach((d: string) => {
      lines.push(`      ${escapeMermaid(d)}`);
    });
  }

  if (analysis.tasks && analysis.tasks.length > 0) {
    lines.push(`    Tasks`);
    analysis.tasks.forEach((t) => {
      lines.push(`      ${escapeMermaid(t.description || '')}`);
    });
  }

  return lines.join('\n');
}

function escapeMermaid(text: string): string {
  if (!text) return '';
  return text
    .replace(/[`\\]/g, '\\$&')
    .replace(/"/g, "'")
    .replace(/\n/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/\(/g, '')
    .replace(/\)/g, '')
    .replace(/\[/g, '')
    .replace(/\]/g, '')
    .trim();
}

interface SpeakerRecord { name?: string | null }

function generateBasicAnalysis(text: string, speakers: SpeakerRecord[]): AnalysisResult {
  const words = text.split(' ');
  const speakerNames = speakers.map(s => s.name || 'Participante').join(', ');
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  return {
    summary: `Reunión con ${speakers.length} participantes (${speakerNames}). La reunión duró aproximadamente ${Math.round(words.length / 2)} segundos de conversación. Se discutieron ${sentences.length} puntos principales.`,
    keyPoints: [
      sentences[0]?.substring(0, 100) || 'Punto principal de la reunión',
      sentences[1]?.substring(0, 100) || 'Segundo punto discutido',
      sentences[2]?.substring(0, 100) || 'Tercer punto relevante',
      sentences[3]?.substring(0, 100) || 'Cuarto punto importante',
      sentences[4]?.substring(0, 100) || 'Quinto punto mencionado'
    ].filter(s => s.length > 10),
    decisions: extractDecisionsFromText(text),
    risks: extractRisksFromText(text),
    openQuestions: extractQuestionsFromText(text),
    tasks: extractTasksFromText(text, speakers),
    dates: extractDatesFromText(text),
    mindmap: generateMindmapFromBasic(text, speakers)
  };
}

function extractDecisionsFromText(text: string): string[] {
  const decisionPatterns = /(?:decidimos|acordamos|aprobamos|confirmamos|establecimos|definimos)[^.!?]*[.!?]/gi;
  const matches = text.match(decisionPatterns) || [];
  return matches.slice(0, 5).map(m => m.substring(0, 80).trim());
}

function extractRisksFromText(text: string): string[] {
  const riskPatterns = /(?:riesgo|problema|dificultad|impedimento|obstáculo|retraso)[^.!?]*[.!?]/gi;
  const matches = text.match(riskPatterns) || [];
  return matches.slice(0, 3).map(m => m.substring(0, 80).trim());
}

function extractQuestionsFromText(text: string): string[] {
  const questionPatterns = /[¿?][^?]+[?]/g;
  const matches = text.match(questionPatterns) || [];
  return matches.slice(0, 3).map(m => m.trim());
}

function extractTasksFromText(text: string, speakers: SpeakerRecord[]): Array<{description: string, owner?: string, priority: string, dueDate?: string}> {
  const taskPatterns = /(?:tarea|acción|encargo|responsabilidad)[^.]*[:\s]+([^.]+)/gi;
  const matches = text.match(taskPatterns) || [];
  return matches.slice(0, 5).map((m, i) => ({
    description: m.substring(0, 60).trim(),
    owner: speakers[i % speakers.length]?.name ?? undefined,
    priority: 'MEDIUM'
  }));
}

function extractDatesFromText(text: string): Array<{date: string, description: string}> {
  const datePatterns = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/g;
  const matches = text.match(datePatterns) || [];
  return matches.slice(0, 3).map(d => ({
    date: d,
    description: 'Fecha mencionada'
  }));
}

function generateMindmapFromBasic(text: string, speakers: SpeakerRecord[]): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text.substring(0, 100)];
  
  let mermaid = 'mindmap\n';
  mermaid += '  root((Meeting))\n';
  mermaid += '    Summary\n';
  mermaid += '      - ' + escapeMermaid(sentences[0]?.substring(0, 80) || 'Meeting') + '\n';
  mermaid += '    Key Points\n';
  sentences.slice(1, 6).forEach(s => {
    mermaid += '      - ' + escapeMermaid(s.substring(0, 50)) + '\n';
  });
  mermaid += '    Participants\n';
  speakers.forEach(s => {
    mermaid += '      - ' + escapeMermaid(s.name || 'Participante') + '\n';
  });
  
  return mermaid;
}

interface TranscriptArg { speakers: SpeakerRecord[] }

interface MindmapAnalysisInput {
  summary?: string | null;
  keyPoints?: string[];
  decisions?: string[];
  tasks?: Array<{ description?: string | null }>;
}

export function generateMindmapFromTranscript(transcript: TranscriptArg, analysis: MindmapAnalysisInput): string {
  const lines: string[] = ['mindmap', '  root((Meeting))'];
  
  if (analysis.summary) {
    lines.push('    Summary');
    lines.push(`      ${escapeMermaid(analysis.summary)}`);
  }
  
  if (analysis.keyPoints && analysis.keyPoints.length > 0) {
    lines.push('    Key Points');
    analysis.keyPoints.forEach((kp: string) => {
      lines.push(`      ${escapeMermaid(kp)}`);
    });
  }

  if (analysis.decisions && analysis.decisions.length > 0) {
    lines.push('    Decisions');
    analysis.decisions.forEach((d: string) => {
      lines.push(`      ${escapeMermaid(d)}`);
    });
  }

  if (analysis.tasks && analysis.tasks.length > 0) {
    lines.push('    Tasks');
    analysis.tasks.forEach((t) => {
      lines.push(`      ${escapeMermaid(t.description || '')}`);
    });
  }

  if (transcript.speakers && transcript.speakers.length > 0) {
    lines.push('    Participants');
    transcript.speakers.forEach((s) => {
      lines.push(`      ${escapeMermaid(s.name || 'Participant')}`);
    });
  }
  
  return lines.join('\n');
}
