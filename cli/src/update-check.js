import { compararVersoes, versaoSegura } from './release.js';
import { escreverArquivoAtomicamente, lerArquivoJson } from './state.js';

const TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_ARQUIVO = 'update-check.json';

async function buscarLatest(fetchFn) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 3000);
  try {
    const r = await fetchFn('https://api.github.com/repos/claudioorjunior/geronticare/releases/latest', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const tag = String(d.tag_name ?? d.name ?? '').replace(/^v/, '');
    return versaoSegura(tag) ? tag : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function verificarAtualizacao({
  root,
  versaoAtual,
  fetchFn = fetch,
  lerCache = lerArquivoJson,
  escreverCache = escreverArquivoAtomicamente,
  agora = Date.now,
} = {}) {
  if (!versaoSegura(versaoAtual)) return null;
  const vAtual = String(versaoAtual).replace(/^v/, '');
  try {
    const cache = await lerCache(root, CACHE_ARQUIVO);
    const checkedAt = cache?.checkedAt ? Date.parse(cache.checkedAt) : NaN;
    const fresh = Number.isFinite(checkedAt) && agora() - checkedAt < TTL_MS;
    if (fresh && versaoSegura(cache.latest)) {
      const latest = String(cache.latest).replace(/^v/, '');
      if (compararVersoes(latest, vAtual) > 0) return { atual: vAtual, latest, fromCache: true };
      return null;
    }
  } catch {}
  const latest = await buscarLatest(fetchFn);
  if (!latest) return null;
  try {
    await escreverCache(root, CACHE_ARQUIVO, { latest, checkedAt: new Date(agora()).toISOString() });
  } catch {}
  if (compararVersoes(latest, vAtual) > 0) return { atual: vAtual, latest, fromCache: false };
  return null;
}

export function formatarAviso({ atual, latest }) {
  return `Nova versão disponível: v${latest} (atual v${atual}) — rode 'geronticare upgrade' para atualizar.`;
}
