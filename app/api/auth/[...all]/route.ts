import { NextRequest } from 'next/server';
import { getAuth } from '@/lib/auth';
import { withPrivateNoStore } from '@/lib/http/private-response';

async function handler(request: NextRequest) {
  const auth = await getAuth();
  const response = await auth.handler(request);
  return withPrivateNoStore(response);
}

export { handler as GET, handler as POST };
