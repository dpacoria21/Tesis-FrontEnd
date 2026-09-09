import type { CorpusChunk } from '../corpus/schema'
import type { RetrievalFilters } from './types'
import { normalizedFilterLabel } from './tokenizer'

function normalizedSet(values: readonly string[] | undefined): Set<string> | undefined {
  if (!values || values.length === 0) return undefined
  return new Set(values.map(normalizedFilterLabel))
}

function hasAny(values: readonly string[], expected: Set<string> | undefined): boolean {
  if (!expected) return true
  return values.some((value) => expected.has(normalizedFilterLabel(value)))
}

export function hasEffectiveFilters(filters: RetrievalFilters | undefined): boolean {
  if (!filters) return false
  return (
    (filters.topicsAny?.length ?? 0) > 0 ||
    (filters.tagsAny?.length ?? 0) > 0 ||
    (filters.difficultyBands?.length ?? 0) > 0 ||
    filters.rating?.min !== undefined ||
    filters.rating?.max !== undefined ||
    (filters.contentTypes?.length ?? 0) > 0 ||
    (filters.languages?.length ?? 0) > 0 ||
    (filters.programmingLanguagesAny?.length ?? 0) > 0 ||
    (filters.problemIds?.length ?? 0) > 0 ||
    (filters.accessLevels?.length ?? 0) > 0 ||
    (filters.sourceKinds?.length ?? 0) > 0
  )
}

export function filterCorpusChunks(
  chunks: readonly CorpusChunk[],
  filters: RetrievalFilters | undefined,
): CorpusChunk[] {
  if (!hasEffectiveFilters(filters) || !filters) return [...chunks]

  const topics = normalizedSet(filters.topicsAny)
  const tags = normalizedSet(filters.tagsAny)
  const languages = normalizedSet(filters.languages)
  const programmingLanguages = normalizedSet(filters.programmingLanguagesAny)
  const problemIds = normalizedSet(filters.problemIds)

  return chunks.filter((chunk) => {
    const metadata = chunk.metadata
    if (!hasAny(metadata.topics, topics)) return false
    if (!hasAny(metadata.tags, tags)) return false
    if (languages && !languages.has(normalizedFilterLabel(metadata.language))) return false
    if (!hasAny(metadata.programmingLanguages, programmingLanguages)) return false
    if (
      problemIds &&
      !problemIds.has(normalizedFilterLabel(metadata.problemId)) &&
      !problemIds.has(normalizedFilterLabel(metadata.externalProblemId))
    ) {
      return false
    }
    if (
      filters.difficultyBands?.length &&
      !filters.difficultyBands.includes(metadata.difficulty)
    ) {
      return false
    }
    if (filters.rating?.min !== undefined && metadata.rating < filters.rating.min) return false
    if (filters.rating?.max !== undefined && metadata.rating > filters.rating.max) return false
    if (filters.contentTypes?.length && !filters.contentTypes.includes(metadata.contentType)) {
      return false
    }
    if (filters.accessLevels?.length && !filters.accessLevels.includes(metadata.accessLevel)) {
      return false
    }
    if (filters.sourceKinds?.length && !filters.sourceKinds.includes(metadata.sourceKind)) {
      return false
    }
    return true
  })
}
