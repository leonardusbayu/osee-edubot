import { Hono } from 'hono';
import type { Env } from '../types';

export const speakingRoutes = new Hono<{ Bindings: Env }>();

// Evaluate a speaking recording: transcribe + score
speakingRoutes.post('/evaluate', async (c) => {
  if (!c.env.OPENAI_API_KEY) {
    return c.json({ error: 'OpenAI API not configured' }, 500);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Invalid request. Send multipart/form-data with audio file.' }, 400);
  }

  const audioFile = formData.get('audio') as File | null;
  const prompt = formData.get('prompt') as string || '';
  const questionType = formData.get('question_type') as string || 'interview';

  if (!audioFile) {
    return c.json({ error: 'No audio file' }, 400);
  }

  try {
    // Step 1: Transcribe with Whisper
    const whisperForm = new FormData();
    whisperForm.append('file', audioFile, 'recording.webm');
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('response_format', 'text');
    whisperForm.append('language', 'en');

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${c.env.OPENAI_API_KEY}` },
      body: whisperForm,
    });

    if (!whisperResponse.ok) {
      const err = await whisperResponse.text();
      return c.json({ error: `Transcription failed: ${err}` }, 500);
    }

    const transcription = (await whisperResponse.text()).trim();

    if (!transcription || transcription.length < 2) {
      return c.json({
        transcription: '',
        score: 0,
        feedback: 'Tidak terdeteksi suara. Pastikan mikrofon kamu berfungsi dan coba lagi.',
        criteria: {},
      });
    }

    // Step 2: Score based on question type
    if (questionType === 'listen_and_repeat') {
      // Compare transcription to original text
      const result = scoreListenAndRepeat(transcription, prompt);
      return c.json(result);
    } else {
      // Interview: AI scoring
      const result = await scoreInterview(c.env.OPENAI_API_KEY, transcription, prompt);
      return c.json(result);
    }
  } catch (e: any) {
    return c.json({ error: e.message || 'Evaluation failed' }, 500);
  }
});

// Listen & Repeat: word-by-word accuracy comparison
function scoreListenAndRepeat(transcription: string, original: string) {
  const originalWords = original.toLowerCase().replace(/[^a-z\s']/g, '').split(/\s+/).filter(Boolean);
  const spokenWords = transcription.toLowerCase().replace(/[^a-z\s']/g, '').split(/\s+/).filter(Boolean);

  let matchCount = 0;
  const wordResults: { word: string; matched: boolean }[] = [];
  const spokenSet = new Set(spokenWords); // Use Set for O(1) exact-match lookup

  for (const word of originalWords) {
    // Exact word match only (not partial)
    const matched = spokenSet.has(word);
    if (matched) matchCount++;
    wordResults.push({ word, matched });
  }

  const accuracy = originalWords.length > 0 ? Math.round((matchCount / originalWords.length) * 100) : 0;

  // Map accuracy to band score (1-6)
  let band = 1;
  if (accuracy >= 90) band = 6;
  else if (accuracy >= 80) band = 5;
  else if (accuracy >= 70) band = 4;
  else if (accuracy >= 55) band = 3;
  else if (accuracy >= 40) band = 2;

  const missedWords = wordResults.filter(w => !w.matched).map(w => w.word);

  let feedback = '';
  if (accuracy >= 90) {
    feedback = 'Sangat bagus! Hampir sempurna.';
  } else if (accuracy >= 70) {
    feedback = `Bagus! Beberapa kata yang terlewat: ${missedWords.slice(0, 5).join(', ')}`;
  } else if (accuracy >= 50) {
    feedback = `Cukup. Kata yang perlu diperbaiki: ${missedWords.slice(0, 5).join(', ')}. Coba dengarkan lagi dan ulangi.`;
  } else {
    feedback = `Perlu latihan lagi. Dengarkan audio pelan-pelan, lalu ulangi kata per kata.`;
  }

  return {
    transcription,
    score: band,
    accuracy,
    feedback,
    criteria: {
      word_accuracy: accuracy,
      matched: matchCount,
      total: originalWords.length,
    },
    missed_words: missedWords,
    word_results: wordResults,
  };
}

// Interview: AI-powered scoring
async function scoreInterview(apiKey: string, transcription: string, prompt: string) {
  const scoringPrompt = `Score this TOEFL iBT speaking response on a 1-6 band scale.

Question prompt: "${prompt}"

Student's spoken response (transcription): "${transcription}"

Score on these criteria (each 1-6):
1. Content: Did they answer the question? Is the response relevant?
2. Fluency: Does it flow naturally? (Note: this is a transcription, so ignore minor artifacts)
3. Grammar: Are sentences grammatically correct?
4. Vocabulary: Range and accuracy of word choice

Respond in JSON only:
{
  "overall_band": <number 1-6, in 0.5 increments>,
  "content": <number>,
  "fluency": <number>,
  "grammar": <number>,
  "vocabulary": <number>,
  "feedback": "<2-3 sentences of specific, actionable feedback in Bahasa Indonesia. Gunakan 'kamu'. Sebutkan contoh spesifik dari respons siswa.>",
  "strengths": "<1 specific thing they did well>",
  "improvement": "<1 specific thing to practice>"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          { role: 'system', content: 'You are a TOEFL iBT speaking section scorer. Always respond with valid JSON only.' },
          { role: 'user', content: scoringPrompt },
        ],
      }),
    });

    const data: any = await response.json();
    const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');

    return {
      transcription,
      score: result.overall_band || 1,
      feedback: result.feedback || 'Tidak bisa memberikan feedback.',
      criteria: {
        content: result.content || 1,
        fluency: result.fluency || 1,
        grammar: result.grammar || 1,
        vocabulary: result.vocabulary || 1,
      },
      strengths: result.strengths || '',
      improvement: result.improvement || '',
    };
  } catch (e: any) {
    return {
      transcription,
      score: 0,
      feedback: `Gagal menilai: ${e.message}. Coba lagi.`,
      criteria: {},
    };
  }
}
