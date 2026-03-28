import { NextResponse } from 'next/server';

export async function GET() {
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const onVercel = !!process.env.VERCEL;

  if (hasBlob) {
    try {
      const { list } = await import('@vercel/blob');
      await list({ prefix: 'vocab/' });
      return NextResponse.json({ storage: 'vercel-blob', status: 'ok' });
    } catch (e) {
      return NextResponse.json({ storage: 'vercel-blob', status: 'error', error: String(e) }, { status: 500 });
    }
  }

  if (onVercel) {
    return NextResponse.json(
      { storage: 'none', status: 'error', error: 'BLOB_READ_WRITE_TOKEN not set. Add a Blob store to your Vercel project and redeploy.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ storage: 'local-file', status: 'ok' });
}
