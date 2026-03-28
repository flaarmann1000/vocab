import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { word, from } = await req.json();
    if (!word || !from) {
      return NextResponse.json({ error: 'Missing word or from' }, { status: 400 });
    }

    const direction =
      from === 'slovak'
        ? 'Translate this Slovak word/phrase to German.'
        : 'Translate this German word/phrase to Slovak.';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a Slovak-German dictionary. Return ONLY the translation, no explanation. Use proper Slovak diacritics (á, ä, č, ď, dz, dž, é, í, ľ, ĺ, ň, ó, ô, ŕ, š, ť, ú, ý, ž).',
        },
        {
          role: 'user',
          content: `${direction}\n\n${word}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.1,
    });

    const translation = response.choices[0]?.message?.content?.trim() ?? '';
    return NextResponse.json({ translation });
  } catch (err) {
    console.error('translate error', err);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
