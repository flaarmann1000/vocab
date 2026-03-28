import { NextResponse } from 'next/server';
import { getSettingsDB, saveSettingsDB } from '@/lib/db';

export const dynamic = 'force-dynamic';
import type { AppSettings } from '@/lib/types';

export async function GET() {
  const settings = await getSettingsDB();
  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const body = await req.json() as AppSettings;
  await saveSettingsDB(body);
  return NextResponse.json(body);
}
