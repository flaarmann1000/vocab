import { NextResponse } from 'next/server';
import { getCollectionsDB, saveCollectionsDB } from '@/lib/db';
import type { VocabCollection } from '@/lib/types';

export async function GET() {
  const collections = await getCollectionsDB();
  return NextResponse.json(collections);
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const collections = await getCollectionsDB();
  const newCollection: VocabCollection = {
    id: crypto.randomUUID(),
    name: name.trim(),
    items: [],
    createdAt: Date.now(),
  };
  await saveCollectionsDB([...collections, newCollection]);
  return NextResponse.json(newCollection, { status: 201 });
}
