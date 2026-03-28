import { NextResponse } from 'next/server';
import { getCollectionsDB, getCollectionsDBWithRetry, saveCollectionsDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collections = await getCollectionsDB();
  const collection = collections.find((c) => c.id === id);
  if (!collection) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(collection);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const collections = await getCollectionsDBWithRetry();
  const idx = collections.findIndex((c) => c.id === id);
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const updated = { ...collections[idx], ...body };
  const newCollections = [...collections];
  newCollections[idx] = updated;
  await saveCollectionsDB(newCollections);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collections = await getCollectionsDBWithRetry();
  await saveCollectionsDB(collections.filter((c) => c.id !== id));
  return new Response(null, { status: 204 });
}
