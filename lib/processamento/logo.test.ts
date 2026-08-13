import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  ErroProcessamentoLogo,
  LOGO_TAMANHO,
  processarLogo,
} from './logo';

/** Gera um PNG a partir de SVG (determinístico, sem fixtures binárias). */
async function svgPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Lê o pixel (x, y) como [r, g, b, a]. */
async function pixel(buffer: Buffer, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

describe('processarLogo', () => {
  it('remove fundo branco uniforme e preserva o conteúdo', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
        <rect width="200" height="100" fill="#ffffff"/>
        <circle cx="100" cy="50" r="30" fill="#087f73"/>
      </svg>`;
    const resultado = await processarLogo(await svgPng(svg));

    expect(resultado.fundoRemovido).toBe(true);
    expect(resultado.width).toBe(LOGO_TAMANHO);
    expect(resultado.height).toBe(LOGO_TAMANHO);

    // Canto: fundo removido (alpha 0). Centro: círculo preservado (alpha 255).
    const canto = await pixel(resultado.buffer, 0, 0);
    const centro = await pixel(resultado.buffer, 256, 256);
    expect(canto[3]).toBe(0);
    expect(centro[3]).toBe(255);
    expect(centro[0]).toBeGreaterThan(0); // cor teal preservada (r < 255)
    expect(centro[0]).toBeLessThan(255);
  });

  it('preserva o interior do desenho mesmo com a cor do fundo dentro dele', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
        <rect width="200" height="100" fill="#ffffff"/>
        <rect x="60" y="10" width="80" height="80" fill="#087f73"/>
        <circle cx="100" cy="50" r="15" fill="#ffffff"/>
      </svg>`;
    const resultado = await processarLogo(await svgPng(svg));

    expect(resultado.fundoRemovido).toBe(true);
    // Centro da imagem: ponto branco dentro do retângulo teal deve sobreviver
    // porque o flood fill não atravessa o contorno teal.
    const centro = await pixel(resultado.buffer, 256, 256);
    expect(centro[3]).toBe(255);
    expect(centro[0]).toBeGreaterThan(200); // branco interno preservado
  });

  it('corta borda morta de PNG já transparente', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
        <rect x="120" y="160" width="160" height="80" fill="#087f73"/>
      </svg>`;
    const resultado = await processarLogo(await svgPng(svg));

    // Sem canvas fixo: proporção preservada (conteúdo 2:1 → 512×256).
    expect(resultado.width).toBe(LOGO_TAMANHO);
    expect(resultado.height).toBe(LOGO_TAMANHO / 2);

    // Sem letterbox: o topo do resultado já é o conteúdo (teal opaco),
    // não uma faixa transparente de borda morta.
    const topo = await pixel(resultado.buffer, 256, 0);
    const meio = await pixel(resultado.buffer, 256, 128);
    expect(topo[3]).toBe(255);
    expect(meio[3]).toBe(255);
  });

  it('não remove fundo não uniforme (gradiente), mas ainda normaliza', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="150">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#000000"/>
            <stop offset="1" stop-color="#ffffff"/>
          </linearGradient>
        </defs>
        <rect width="300" height="150" fill="url(#g)"/>
        <circle cx="150" cy="75" r="40" fill="#087f73"/>
      </svg>`;
    const resultado = await processarLogo(await svgPng(svg));

    expect(resultado.fundoRemovido).toBe(false);
    expect(resultado.width).toBe(LOGO_TAMANHO);
    expect(resultado.height).toBe(LOGO_TAMANHO / 2);
  });

  it('rejeita imagem sem conteúdo identificável', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <rect width="100" height="100" fill="#ffffff"/>
      </svg>`;
    await expect(processarLogo(await svgPng(svg))).rejects.toThrow(ErroProcessamentoLogo);
  });

  it('rejeita conteúdo minúsculo (logo ocupa quase nada da imagem)', async () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
        <rect width="400" height="400" fill="#ffffff"/>
        <circle cx="200" cy="200" r="4" fill="#087f73"/>
      </svg>`;
    await expect(processarLogo(await svgPng(svg))).rejects.toThrow(ErroProcessamentoLogo);
  });

  it('rejeita buffer que não é imagem', async () => {
    await expect(processarLogo(Buffer.from('não sou imagem'))).rejects.toThrow(ErroProcessamentoLogo);
  });
});
