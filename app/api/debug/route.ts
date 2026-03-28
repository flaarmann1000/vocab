import { NextResponse } from 'next/server';

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'No BLOB_READ_WRITE_TOKEN' }, { status: 503 });
  }
  const { list } = await import('@vercel/blob');
  // List everything in the store (no prefix filter)
  const { blobs } = await list();
  return NextResponse.json({
    count: blobs.length,
    blobs: blobs.map((b) => ({ pathname: b.pathname, url: b.url, size: b.size, uploadedAt: b.uploadedAt })),
  });
}
