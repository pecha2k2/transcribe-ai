interface TTSOptions {
  text: string;
  languageCode?: string;
  voiceName?: string;
}

export async function generateSpeech(options: TTSOptions): Promise<Buffer> {
  const { text, languageCode = 'es-ES', voiceName = 'aura-2-es-es' } = options;
  
  const apiKey = process.env.DEEPGRAM_API_KEY;
  
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY not configured');
  }

  const response = await fetch(
    'https://api.deepgram.com/v1/speak',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model: voiceName,
        language: languageCode,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Deepgram TTS error: ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer);
}
