import { NextRequest } from 'next/server';
import { getAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await getAuth();
  return auth.handler(request);
}

export async function POST(request: NextRequest) {
  const auth = await getAuth();
  return auth.handler(request);
}
