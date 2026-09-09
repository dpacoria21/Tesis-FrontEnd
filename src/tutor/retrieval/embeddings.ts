import { stableDigest } from '../corpus/schema'
import { tokenize } from './tokenizer'

export interface EmbeddingDescriptor {
  providerId: string
  modelId: string
  modelVersion: string
  dimensions: number
  normalization: 'l2'
  deterministic: boolean
  configurationDigest: string
}

export interface EmbeddingProvider {
  readonly descriptor: EmbeddingDescriptor
  embed(text: string): number[]
  embedBatch(texts: readonly string[]): number[][]
}

export interface DeterministicEmbeddingOptions {
  dimensions?: number
  semanticFeatureWeight?: number
  bigramWeight?: number
}

const SEMANTIC_GROUPS: Readonly<Record<string, readonly string[]>> = {
  arithmetic_sum: ['suma', 'sumar', 'agregar', 'total', 'adicion', 'anadir'],
  array_sequence: ['arreglo', 'array', 'vector', 'lista', 'secuencia', 'coleccion'],
  maximum: ['maximo', 'mayor', 'grande', 'supera'],
  frequency: ['frecuencia', 'contar', 'contador', 'apariciones', 'coincidencias'],
  equality: ['igual', 'igualdad', 'coincide', 'objetivo'],
  parentheses: ['parentesis', 'apertura', 'cierre', 'balanceada', 'balance'],
  stack: ['pila', 'stack', 'ultimo'],
  sliding_window: ['ventana', 'segmento', 'tramo', 'contiguo', 'subarreglo'],
  two_pointers: ['punteros', 'izquierda', 'derecha', 'extremos'],
  graph: ['grafo', 'grafos', 'vertice', 'nodo', 'sala', 'pasillo', 'adyacencia'],
  traversal: ['bfs', 'dfs', 'recorrer', 'alcanzable', 'visitado', 'cola', 'componente'],
  complexity: ['complejidad', 'tiempo', 'espacio', 'lineal', 'cuadratico'],
}

function hashFeature(feature: string, seed: number): number {
  let hash = seed >>> 0
  for (let index = 0; index < feature.length; index += 1) {
    hash = Math.imul(hash ^ feature.charCodeAt(index), 0x01000193) >>> 0
  }
  return hash >>> 0
}

function addFeature(vector: number[], feature: string, weight: number): void {
  const index = hashFeature(feature, 0x811c9dc5) % vector.length
  const sign = (hashFeature(feature, 0x9e3779b9) & 1) === 0 ? 1 : -1
  vector[index] += weight * sign
}

function normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  return norm === 0 ? vector : vector.map((value) => value / norm)
}

export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly descriptor: EmbeddingDescriptor
  private readonly semanticFeatureWeight: number
  private readonly bigramWeight: number

  constructor(options: DeterministicEmbeddingOptions = {}) {
    const dimensions = options.dimensions ?? 192
    const semanticFeatureWeight = options.semanticFeatureWeight ?? 1.75
    const bigramWeight = options.bigramWeight ?? 0.35
    if (!Number.isInteger(dimensions) || dimensions < 32 || dimensions > 4096) {
      throw new Error('Embedding dimensions must be an integer between 32 and 4096.')
    }
    if (!Number.isFinite(semanticFeatureWeight) || semanticFeatureWeight < 0) {
      throw new Error('semanticFeatureWeight must be a finite non-negative number.')
    }
    if (!Number.isFinite(bigramWeight) || bigramWeight < 0) {
      throw new Error('bigramWeight must be a finite non-negative number.')
    }

    this.semanticFeatureWeight = semanticFeatureWeight
    this.bigramWeight = bigramWeight
    const configuration = {
      dimensions,
      semanticFeatureWeight,
      bigramWeight,
      tokenizer: 'unicode_nfd_lower_stopwords_v1',
      semanticLexicon: 'competitive_programming_es_v1',
    }
    this.descriptor = {
      providerId: 'local_deterministic',
      modelId: 'feature_hash_semantic_lexicon',
      modelVersion: '1.0.0',
      dimensions,
      normalization: 'l2',
      deterministic: true,
      configurationDigest: stableDigest(configuration),
    }
  }

  embed(text: string): number[] {
    const tokens = tokenize(text)
    const vector = Array<number>(this.descriptor.dimensions).fill(0)
    tokens.forEach((token) => addFeature(vector, `token:${token}`, 1))
    for (let index = 0; index + 1 < tokens.length; index += 1) {
      addFeature(vector, `bigram:${tokens[index]}_${tokens[index + 1]}`, this.bigramWeight)
    }

    const tokenSet = new Set(tokens)
    for (const [group, aliases] of Object.entries(SEMANTIC_GROUPS)) {
      if (aliases.some((alias) => tokenSet.has(alias))) {
        addFeature(vector, `semantic:${group}`, this.semanticFeatureWeight)
      }
    }
    return normalize(vector)
  }

  embedBatch(texts: readonly string[]): number[][] {
    return texts.map((text) => this.embed(text))
  }
}

export function vectorNorm(vector: readonly number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
}

export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length) throw new Error('Cannot compare vectors with different dimensions.')
  const leftNorm = vectorNorm(left)
  const rightNorm = vectorNorm(right)
  if (leftNorm === 0 || rightNorm === 0) return 0
  let dot = 0
  for (let index = 0; index < left.length; index += 1) dot += left[index] * right[index]
  return dot / (leftNorm * rightNorm)
}

export function assertValidEmbedding(
  vector: readonly number[],
  descriptor: EmbeddingDescriptor,
): void {
  if (vector.length !== descriptor.dimensions) {
    throw new Error(
      `Embedding dimension mismatch: expected ${descriptor.dimensions}, received ${vector.length}.`,
    )
  }
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding contains a non-finite value.')
  }
}
