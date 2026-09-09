import type {
  CodeforcesContest,
  CodeforcesProblemset,
  CodeforcesRatingChange,
  CodeforcesSubmission,
  CodeforcesUser,
  ProblemCatalogEntry,
} from '../types'

const CODEFORCES_API_BASE = 'https://codeforces.com/api'
export const CODEFORCES_MIN_REQUEST_INTERVAL_MS = 2100

type CodeforcesApiResponse<T> =
  | { status: 'OK'; result: T }
  | { status: 'FAILED'; comment?: string }

export class CodeforcesApiError extends Error {
  readonly endpoint: string
  readonly httpStatus?: number

  constructor(message: string, endpoint: string, httpStatus?: number) {
    super(message)
    this.name = 'CodeforcesApiError'
    this.endpoint = endpoint
    this.httpStatus = httpStatus
  }
}

export class MinimumIntervalQueue {
  private tail: Promise<void> = Promise.resolve()
  private lastStartedAt = 0

  constructor(
    readonly minimumIntervalMs: number = CODEFORCES_MIN_REQUEST_INTERVAL_MS,
  ) {
    if (minimumIntervalMs < CODEFORCES_MIN_REQUEST_INTERVAL_MS) {
      throw new RangeError(
        `Codeforces requests must be spaced by at least ${CODEFORCES_MIN_REQUEST_INTERVAL_MS} ms.`,
      )
    }
  }

  enqueue<T>(request: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      const remaining =
        this.minimumIntervalMs - (Date.now() - this.lastStartedAt)
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining))
      }
      this.lastStartedAt = Date.now()
      return request()
    })
    this.tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}

export interface UserStatusOptions {
  from?: number
  count?: number
  signal?: AbortSignal
}

export interface ProblemsetOptions {
  tags?: readonly string[]
  problemsetName?: string
  signal?: AbortSignal
}

export class CodeforcesClient {
  constructor(
    private readonly queue = new MinimumIntervalQueue(),
    private readonly apiBase = CODEFORCES_API_BASE,
  ) {}

  private request<T>(
    endpoint: string,
    params: Record<string, string | number | undefined>,
    signal?: AbortSignal,
  ): Promise<T> {
    return this.queue.enqueue(async () => {
      const search = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) search.set(key, String(value))
      }
      const url = `${this.apiBase}/${endpoint}${search.size ? `?${search}` : ''}`
      const response = await fetch(url, { signal })
      let payload: CodeforcesApiResponse<T>
      try {
        payload = (await response.json()) as CodeforcesApiResponse<T>
      } catch {
        throw new CodeforcesApiError(
          `Codeforces returned an unreadable response (${response.status}).`,
          endpoint,
          response.status,
        )
      }

      if (!response.ok || payload.status !== 'OK') {
        const comment = payload.status === 'FAILED' ? payload.comment : undefined
        throw new CodeforcesApiError(
          comment ?? `Codeforces request failed (${response.status}).`,
          endpoint,
          response.status,
        )
      }
      return payload.result
    })
  }

  async userInfo(handle: string, signal?: AbortSignal): Promise<CodeforcesUser> {
    const users = await this.request<CodeforcesUser[]>(
      'user.info',
      { handles: handle, checkHistoricHandles: 'false' },
      signal,
    )
    const user = users[0]
    if (!user) throw new CodeforcesApiError('Codeforces user was not found.', 'user.info')
    return user
  }

  userStatus(
    handle: string,
    options: UserStatusOptions = {},
  ): Promise<CodeforcesSubmission[]> {
    return this.request<CodeforcesSubmission[]>(
      'user.status',
      { handle, from: options.from, count: options.count },
      options.signal,
    )
  }

  userRating(
    handle: string,
    signal?: AbortSignal,
  ): Promise<CodeforcesRatingChange[]> {
    return this.request<CodeforcesRatingChange[]>(
      'user.rating',
      { handle },
      signal,
    )
  }

  problemset(options: ProblemsetOptions = {}): Promise<CodeforcesProblemset> {
    return this.request<CodeforcesProblemset>(
      'problemset.problems',
      {
        tags: options.tags?.filter(Boolean).join(';') || undefined,
        problemsetName: options.problemsetName,
      },
      options.signal,
    )
  }

  contestList(
    gym = false,
    signal?: AbortSignal,
  ): Promise<CodeforcesContest[]> {
    return this.request<CodeforcesContest[]>(
      'contest.list',
      { gym: String(gym) },
      signal,
    )
  }
}

export const codeforcesClient = new CodeforcesClient()

export const fetchUserInfo = (
  handle: string,
  signal?: AbortSignal,
): Promise<CodeforcesUser> => codeforcesClient.userInfo(handle, signal)

export const fetchUserStatus = (
  handle: string,
  options?: UserStatusOptions,
): Promise<CodeforcesSubmission[]> =>
  codeforcesClient.userStatus(handle, options)

export const fetchUserRating = (
  handle: string,
  signal?: AbortSignal,
): Promise<CodeforcesRatingChange[]> =>
  codeforcesClient.userRating(handle, signal)

export const fetchProblemset = (
  options?: ProblemsetOptions,
): Promise<CodeforcesProblemset> => codeforcesClient.problemset(options)

export const fetchContestList = (
  gym = false,
  signal?: AbortSignal,
): Promise<CodeforcesContest[]> => codeforcesClient.contestList(gym, signal)

export function problemsetToCatalog(
  problemset: CodeforcesProblemset,
  minimumRating = 1200,
  maximumRating = 1800,
): ProblemCatalogEntry[] {
  const solvedCounts = new Map(
    problemset.problemStatistics.map((statistics) => [
      `${statistics.contestId ?? ''}:${statistics.index}`,
      statistics.solvedCount,
    ]),
  )

  return problemset.problems.flatMap((problem) => {
    if (
      problem.contestId === undefined ||
      problem.rating === undefined ||
      problem.rating < minimumRating ||
      problem.rating > maximumRating
    ) {
      return []
    }
    const id = `${problem.contestId}${problem.index}`
    return [
      {
        id,
        contestId: problem.contestId,
        index: problem.index,
        name: problem.name,
        rating: problem.rating,
        tags: [...problem.tags],
        url: `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`,
        solvedCount: solvedCounts.get(`${problem.contestId}:${problem.index}`),
        source: 'codeforces' as const,
      },
    ]
  })
}

export function acceptedProblemIds(
  submissions: readonly CodeforcesSubmission[],
): Set<string> {
  return new Set(
    submissions.flatMap((submission) => {
      if (submission.verdict !== 'OK' || submission.problem.contestId === undefined) {
        return []
      }
      return [`${submission.problem.contestId}${submission.problem.index}`]
    }),
  )
}
