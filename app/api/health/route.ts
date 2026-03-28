import { NextResponse } from 'next/server';

export async function GET() {
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const onVercel = !!process.env.VERCEL;

  if (!hasBlob) {
    return NextResponse.json(
      onVercel
        ? { storage: 'none', status: 'error', error: 'BLOB_READ_WRITE_TOKEN not set.' }
        : { storage: 'local-file', status: 'ok' },
      { status: onVercel ? 503 : 200 }
    );
  }

  // Test write
  try {
    const { put } = await import('@vercel/blob');
    await put('vocab/.health-check', 'ok', {
      access: 'private',
      contentType: 'text/plain',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    return NextResponse.json({ storage: 'vercel-blob', status: 'error', op: 'put', error: String(e) }, { status: 500 });
  }

  // Test read via pathname (same approach as db.ts — avoids list() caching issues)
  try {
    const { get } = await import('@vercel/blob');
    const result = await get('vocab/.health-check', { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) throw new Error('No content');
    const text = await new Response(result.stream).text();
    if (text !== 'ok') throw new Error('Unexpected content: ' + text);
  } catch (e) {
    return NextResponse.json({ storage: 'vercel-blob', status: 'error', op: 'get', error: String(e) }, { status: 500 });
  }

  return NextResponse.json({ storage: 'vercel-blob', status: 'ok' });
}
