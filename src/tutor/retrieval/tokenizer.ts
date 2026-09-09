const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu

const SPANISH_STOPWORDS = new Set([
  'a',
  'al',
  'cada',
  'como',
  'con',
  'cuál',
  'de',
  'del',
  'el',
  'en',
  'es',
  'la',
  'las',
  'lo',
  'los',
  'para',
  'por',
  'que',
  'se',
  'si',
  'sin',
  'su',
  'un',
  'una',
  'y',
])

export interface TokenizerOptions {
  removeStopwords?: boolean
}

export function normalizeForRetrieval(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-PE')
}

export function tokenize(text: string, options: TokenizerOptions = {}): string[] {
  const tokens = normalizeForRetrieval(text).match(TOKEN_PATTERN) ?? []
  return options.removeStopwords === false
    ? tokens
    : tokens.filter((token) => !SPANISH_STOPWORDS.has(token))
}

export function normalizedFilterLabel(value: string): string {
  return normalizeForRetrieval(value).trim().replace(/\s+/g, ' ')
}
