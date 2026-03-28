import { NextResponse } from 'next/server';

export async function GET() {
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const onVercel = !!process.env.VERCEL;

  if (!hasBlob) {
    return NextResponse.json(
      onVercel
        ? { storage: 'none', status: 'error', error: 'BLOB_READ_WRITE_TOKEN not set. Add a Blob store to your Vercel project.' }
        : { storage: 'local-file', status: 'ok' },
      { status: onVercel ? 503 : 200 }
    );
  }

  // Test read
  try {
    const { list } = await import('@vercel/blob');
    await list({ prefix: 'vocab/' });
  } catch (e) {
    return NextResponse.json({ storage: 'vercel-blob', status: 'error', op: 'list', error: String(e) }, { status: 500 });
  }

  // Test write
  try {
    const { put } = await import('@vercel/blob');
    await put('vocab/.health-check', 'ok', {
      access: 'public',
      contentType: 'text/plain',
      addRandomSuffix: false,
    });
  } catch (e) {
    return NextResponse.json({ storage: 'vercel-blob', status: 'error', op: 'put', error: String(e) }, { status: 500 });
  }

  return NextResponse.json({ storage: 'vercel-blob', status: 'ok' });
}
