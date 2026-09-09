import { describe, expect, it } from 'vitest'
import { filterCorpusChunks } from './filters'
import { testChunk } from './testFixtures'

const chunks = [
  testChunk('intro-array', 'arreglo', {
    topics: ['arreglos'],
    tags: ['arrays'],
    rating: 800,
    difficulty: 'introductory',
    contentType: 'concept',
    language: 'es',
    programmingLanguages: ['cpp17'],
    problemId: 'problem-array',
    externalProblemId: 'demo-array',
    accessLevel: 'safe',
  }),
  testChunk('basic-graph', 'grafo', {
    topics: ['grafos'],
    tags: ['graphs', 'bfs'],
    rating: 1100,
    difficulty: 'basic',
    contentType: 'strategy',
    language: 'es',
    programmingLanguages: ['python3'],
    problemId: 'problem-graph',
    externalProblemId: 'demo-graph',
    accessLevel: 'guided',
  }),
  testChunk('english-graph', 'graph', {
    topics: ['grafos'],
    tags: ['graphs'],
    rating: 1500,
    difficulty: 'intermediate',
    contentType: 'editorial',
    language: 'en',
    programmingLanguages: ['cpp17'],
    problemId: 'problem-graph-en',
    externalProblemId: 'demo-graph-en',
    accessLevel: 'solution',
  }),
]

describe('metadata filters', () => {
  it('filters each required metadata dimension in isolation', () => {
    expect(filterCorpusChunks(chunks, { topicsAny: ['arreglos'] }).map((item) => item.id)).toEqual([
      'intro-array',
    ])
    expect(filterCorpusChunks(chunks, { tagsAny: ['bfs'] }).map((item) => item.id)).toEqual([
      'basic-graph',
    ])
    expect(
      filterCorpusChunks(chunks, { difficultyBands: ['intermediate'] }).map((item) => item.id),
    ).toEqual(['english-graph'])
    expect(filterCorpusChunks(chunks, { contentTypes: ['strategy'] }).map((item) => item.id)).toEqual([
      'basic-graph',
    ])
    expect(filterCorpusChunks(chunks, { languages: ['en'] }).map((item) => item.id)).toEqual([
      'english-graph',
    ])
    expect(
      filterCorpusChunks(chunks, { problemIds: ['demo-graph'] }).map((item) => item.id),
    ).toEqual(['basic-graph'])
  })

  it('combines filters with AND while Any fields use OR internally', () => {
    const result = filterCorpusChunks(chunks, {
      topicsAny: ['grafos', 'arreglos'],
      tagsAny: ['graphs'],
      rating: { min: 900, max: 1200 },
      contentTypes: ['strategy', 'editorial'],
      languages: ['es'],
      programmingLanguagesAny: ['python3'],
      problemIds: ['problem-graph'],
      accessLevels: ['guided'],
      sourceKinds: ['demonstration_fixture'],
    })

    expect(result.map((item) => item.id)).toEqual(['basic-graph'])
  })

  it('returns no candidates when a combined condition cannot be satisfied', () => {
    expect(
      filterCorpusChunks(chunks, {
        topicsAny: ['grafos'],
        languages: ['es'],
        contentTypes: ['editorial'],
      }),
    ).toEqual([])
  })
})
