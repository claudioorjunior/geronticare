import sharp from 'sharp';

/**
 * Processamento de logo institucional (upload whitelabel).
 *
 * Pipeline determinístico, sem IA:
 *  1. normaliza para RGBA e limita a dimensão de trabalho;
 *  2. amostra a cor das bordas — se o fundo for uniforme, faz flood fill
 *     (BFS a partir das bordas) tornando transparente o fundo conectado;
 *  3. calcula o bounding box do conteúdo restante (corta borda morta);
 *  4. normaliza para o tamanho máximo (512px no maior lado, proporção
 *     preservada, sem canvas fixo — evita letterbox no slot de 32px).
 *
 * Fundos não uniformes (foto/gradiente) não são removidos: o conteúdo é
 * apenas recortado e normalizado, sem jogar IA no problema.
 */

export const LOGO_TAMANHO = 512;

/** Dimensão máxima de trabalho antes do corte final (limita memória/BFS). */
const LIMITE_DIMENSAO_PREVIA = 2048;

/** Distância euclidiana RGB máxima para considerar um pixel "da mesma cor" do fundo. */
const THRESHOLD_FUNDO = 24;

/** Desvio-padrão médio (por canal) acima do qual o fundo NÃO é tratado como uniforme. */
const DESVIO_MAXIMO_BORDA = 30;

/** Fração mínima da área da imagem que o logo precisa ocupar após o corte. */
const AREA_MINIMA_CONTEUDO = 0.02;

export interface LogoProcessado {
  buffer: Buffer;
  width: number;
  height: number;
  fundoRemovido: boolean;
}

export class ErroProcessamentoLogo extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroProcessamentoLogo';
  }
}

interface CorMedia {
  r: number;
  g: number;
  b: number;
  desvioMedio: number;
}

export async function processarLogo(input: Buffer): Promise<LogoProcessado> {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input).metadata();
  } catch {
    throw new ErroProcessamentoLogo('Arquivo de imagem inválido ou corrompido');
  }
  if (!metadata.width || !metadata.height) {
    throw new ErroProcessamentoLogo('Arquivo de imagem inválido ou corrompido');
  }

  const { pixels, width, height } = await extrairRgba(input);

  const fundo = amostrarBorda(pixels, width, height);
  const fundoUniforme = fundo.desvioMedio < DESVIO_MAXIMO_BORDA;

  let fundoRemovido = false;
  if (fundoUniforme) {
    fundoRemovido = floodFillFundo(pixels, width, height, fundo, THRESHOLD_FUNDO);
  }

  const bbox = bboxConteudo(pixels, width, height);
  if (!bbox) {
    throw new ErroProcessamentoLogo('Não foi possível identificar o logo na imagem');
  }
  if (bbox.width * bbox.height < width * height * AREA_MINIMA_CONTEUDO) {
    throw new ErroProcessamentoLogo('O logo ocupa uma área muito pequena da imagem enviada');
  }

  const buffer = await sharp(pixels, { raw: { width, height, channels: 4 } })
    .extract({ left: bbox.left, top: bbox.top, width: bbox.width, height: bbox.height })
    .resize({
      width: LOGO_TAMANHO,
      height: LOGO_TAMANHO,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const saida = await sharp(buffer).metadata();
  return {
    buffer,
    width: saida.width ?? LOGO_TAMANHO,
    height: saida.height ?? LOGO_TAMANHO,
    fundoRemovido,
  };
}

async function extrairRgba(input: Buffer): Promise<{ pixels: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .rotate() // respeita EXIF
    .resize({ width: LIMITE_DIMENSAO_PREVIA, height: LIMITE_DIMENSAO_PREVIA, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { pixels: data, width: info.width, height: info.height };
}

/** Amostra as 4 arestas e calcula a cor média + desvio (uniformidade). */
function amostrarBorda(pixels: Buffer, width: number, height: number): CorMedia {
  let somaR = 0;
  let somaG = 0;
  let somaB = 0;
  let n = 0;

  const amostras: number[] = [];

  const coletar = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    if (pixels[i + 3] === 0) return; // borda transparente não informa a cor de fundo
    somaR += pixels[i];
    somaG += pixels[i + 1];
    somaB += pixels[i + 2];
    amostras.push(pixels[i], pixels[i + 1], pixels[i + 2]);
    n += 1;
  };

  for (let x = 0; x < width; x += 2) {
    coletar(x, 0);
    coletar(x, height - 1);
  }
  for (let y = 0; y < height; y += 2) {
    coletar(0, y);
    coletar(width - 1, y);
  }

  if (n === 0) {
    // Imagem com bordas 100% transparentes: fundo "uniforme" vazio.
    return { r: 0, g: 0, b: 0, desvioMedio: 0 };
  }

  const mediaR = somaR / n;
  const mediaG = somaG / n;
  const mediaB = somaB / n;

  let somaQuadrado = 0;
  for (let i = 0; i < amostras.length; i += 3) {
    const dr = amostras[i] - mediaR;
    const dg = amostras[i + 1] - mediaG;
    const db = amostras[i + 2] - mediaB;
    somaQuadrado += dr * dr + dg * dg + db * db;
  }
  const desvioMedio = Math.sqrt(somaQuadrado / n);

  return { r: mediaR, g: mediaG, b: mediaB, desvioMedio };
}

/**
 * BFS a partir das bordas: pixels conectados com cor próxima ao fundo viram
 * transparentes. Preserva o interior do desenho (ex.: cruz branca dentro de
 * um coração teal) porque o flood fill não atravessa cores diferentes.
 */
function floodFillFundo(
  pixels: Buffer,
  width: number,
  height: number,
  fundo: CorMedia,
  threshold: number,
): boolean {
  const total = width * height;
  const visitados = new Uint8Array(total);
  const fila = new Int32Array(total);
  let inicio = 0;
  let fim = 0;
  let removidos = 0;

  const tentar = (x: number, y: number) => {
    const idx = y * width + x;
    if (visitados[idx]) return;
    visitados[idx] = 1;
    const i = idx * 4;
    if (pixels[i + 3] === 0) return; // já transparente
    if (distanciaRgb(pixels[i], pixels[i + 1], pixels[i + 2], fundo) <= threshold) {
      pixels[i + 3] = 0;
      removidos += 1;
      fila[fim] = idx;
      fim += 1;
    }
  };

  for (let x = 0; x < width; x += 1) {
    tentar(x, 0);
    tentar(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    tentar(0, y);
    tentar(width - 1, y);
  }

  while (inicio < fim) {
    const idx = fila[inicio];
    inicio += 1;
    const x = idx % width;
    const y = Math.floor(idx / width);
    if (x > 0) tentar(x - 1, y);
    if (x < width - 1) tentar(x + 1, y);
    if (y > 0) tentar(x, y - 1);
    if (y < height - 1) tentar(x, y + 1);
  }

  return removidos > 0;
}

function distanciaRgb(r: number, g: number, b: number, alvo: CorMedia): number {
  const dr = r - alvo.r;
  const dg = g - alvo.g;
  const db = b - alvo.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

interface BBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

function bboxConteudo(pixels: Buffer, width: number, height: number): BBox | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
