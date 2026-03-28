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

  // Test read via list (same as db.ts blobRead)
  try {
    const { list, getDownloadUrl } = await import('@vercel/blob');
    const { blobs } = await list({ prefix: 'vocab/.health-check' });
    const blob = blobs.find((b) => b.pathname === 'vocab/.health-check');
    if (!blob) throw new Error('Blob not found in list');
    const signedUrl = getDownloadUrl(blob.url);
    const res = await fetch(signedUrl, { cache: 'no-store' });
    const text = await res.text();
    if (text !== 'ok') throw new Error('Unexpected content: ' + text);
  } catch (e) {
    return NextResponse.json({ storage: 'vercel-blob', status: 'error', op: 'list+read', error: String(e) }, { status: 500 });
  }

  return NextResponse.json({ storage: 'vercel-blob', status: 'ok' });
}
