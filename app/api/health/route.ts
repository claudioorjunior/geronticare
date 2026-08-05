import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Health check para monitoramento e balanceadores de carga.
 * Não expõe dados — apenas confirma que o processo responde.
 */
export async function GET() {
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
