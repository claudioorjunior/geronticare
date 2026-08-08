import { getAuth } from '@/lib/auth';
import { resolverUsuarioAutorizacao } from '@/lib/auth/resolver-usuario';
import { getDb } from '@/lib/db';
import { temPermissao } from '@/lib/trpc/autorizacao';

export function getRoot(): string {
  const env = process.env as Record<string, string | undefined>;
  if (env.GERONTICARE_HOME) return env.GERONTICARE_HOME;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '/tmp';
  if (process.platform === 'darwin') return `${home}/Library/Application Support/GerontiCare`;
  if (process.platform === 'win32') {
    const base = env.LOCALAPPDATA ?? `${home}/AppData/Local`;
    return `${base}/GerontiCare`;
  }
  const xdg = env.XDG_DATA_HOME ?? `${home}/.local/share`;
  return `${xdg}/geronticare`;
}

export async function requireAdmin(request: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const auth = await getAuth();
  const db = await getDb();
  let session: unknown = null;
  try {
    session = await (auth as unknown as { api: { getSession: (o: { headers: Headers }) => Promise<unknown> } }).api.getSession({ headers: request.headers as unknown as Headers });
  } catch {
    return { ok: false, status: 401, error: 'Não autenticado' };
  }
  const uid = (session as { user?: { id?: string } } | null)?.user?.id;
  if (!uid) return { ok: false, status: 401, error: 'Não autenticado' };
  const user = await resolverUsuarioAutorizacao(db, uid);
  if (!user?.ativo) return { ok: false, status: 403, error: 'Usuário inativo' };
  if (!temPermissao(user.permissoes, 'admin:administrar')) {
    return { ok: false, status: 403, error: 'Apenas administradores' };
  }
  return { ok: true };
}

export function semverGt(a: string, b: string): boolean {
  const semverPartes = (v: string) => {
    const m = String(v).match(/^v?(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number];
  };
  const pa = semverPartes(a);
  const pb = semverPartes(b);
  if (!pa || !pb) return String(a).localeCompare(String(b)) > 0;
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] > pb[i];
  return false;
}

export const UPDATE_STATUS_FILE = 'update-status.json';
