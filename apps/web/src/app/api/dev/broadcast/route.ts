import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publishToRoom } from '@/server/realtime';

const bodySchema = z.object({ room: z.string(), kind: z.string(), data: z.unknown() });

/** Development-only: publish an arbitrary event. Replaced by real writes (comments, results). */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  return NextResponse.json(
    await publishToRoom(parsed.data.room, parsed.data.kind, parsed.data.data),
  );
}
