import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            "Extract all vocabulary word pairs from this image. Return a JSON array of objects with 'slovak' and 'german' keys. Only return valid JSON, no explanation.",
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '[]';
    // Strip potential markdown code fences
    const cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    const items = JSON.parse(cleaned);

    return NextResponse.json({ items });
  } catch (err) {
    console.error('extract-vocab error', err);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
