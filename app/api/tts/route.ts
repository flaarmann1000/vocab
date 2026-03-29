import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function textToPathname(text: string): string {
  return `audio/${Buffer.from(text.trim()).toString('base64url')}.mp3`;
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { list, put } = await import('@vercel/blob');
      const pathname = textToPathname(text);

      // Return cached blob URL if it already exists
      const { blobs } = await list({ prefix: pathname });
      const existing = blobs.find((b) => b.pathname === pathname);
      if (existing) return NextResponse.json({ url: existing.url });

      // Generate via OpenAI, store in Blob, return URL
      const mp3 = await openai.audio.speech.create({ model: 'tts-1', voice: 'nova', input: text });
      const buffer = Buffer.from(await mp3.arrayBuffer());
      const { url } = await put(pathname, buffer, {
        access: 'public',
        contentType: 'audio/mpeg',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return NextResponse.json({ url });
    }

    // Dev fallback: no Blob token, stream binary directly
    const mp3 = await openai.audio.speech.create({ model: 'tts-1', voice: 'nova', input: text });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    return new Response(buffer, {
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': buffer.length.toString() },
    });
  } catch (err) {
    console.error('tts error', err);
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
  }
}
