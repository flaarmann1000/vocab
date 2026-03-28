import { NextResponse } from 'next/server';
import { getCollectionsDB, saveCollectionsDB } from '@/lib/db';
import type { VocabCollection } from '@/lib/types';

export async function GET() {
  const collections = await getCollectionsDB();
  return NextResponse.json(collections);
}

export async function POST(req: Request) {
  try {
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
  } catch (e) {
    console.error('[POST /api/collections]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
