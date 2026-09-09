import type { ProblemCatalogEntry } from '../types'

function codeforcesProblem(
  contestId: number,
  index: string,
  name: string,
  rating: number,
  tags: string[],
): ProblemCatalogEntry {
  return {
    id: `${contestId}${index}`,
    contestId,
    index,
    name,
    rating,
    tags,
    url: `https://codeforces.com/problemset/problem/${contestId}/${index}`,
    source: 'seed',
  }
}

/**
 * Offline-first starter catalog. Ratings and tags mirror Codeforces' public
 * problemset API; most entries cover the 1200–1800 training band, with the
 * report's named 1900–2000 debts retained as gated stretch work.
 */
export const seedProblems: ProblemCatalogEntry[] = [
  codeforcesProblem(433, 'B', "Kuriyama Mirai's Stones", 1200, [
    'dp',
    'implementation',
    'sortings',
  ]),
  codeforcesProblem(474, 'B', 'Worms', 1200, [
    'binary search',
    'implementation',
  ]),
  codeforcesProblem(977, 'C', 'Less or Equal', 1200, ['sortings']),
  codeforcesProblem(1133, 'C', 'Balanced Team', 1200, [
    'sortings',
    'two pointers',
  ]),
  codeforcesProblem(4, 'C', 'Registration System', 1300, [
    'data structures',
    'hashing',
    'implementation',
  ]),
  codeforcesProblem(486, 'B', 'OR in Matrix', 1300, [
    'greedy',
    'hashing',
    'implementation',
  ]),
  codeforcesProblem(600, 'B', 'Queries about less or equal elements', 1300, [
    'binary search',
    'data structures',
    'sortings',
    'two pointers',
  ]),
  codeforcesProblem(1003, 'C', 'Intense Heat', 1300, [
    'brute force',
    'implementation',
    'math',
  ]),
  codeforcesProblem(1030, 'C', 'Vasya and Golden Ticket', 1300, [
    'implementation',
  ]),
  codeforcesProblem(1176, 'C', 'Lose it!', 1300, [
    'dp',
    'greedy',
    'implementation',
  ]),
  codeforcesProblem(295, 'A', 'Greg and Array', 1400, [
    'data structures',
    'implementation',
  ]),
  codeforcesProblem(414, 'B', 'Mashmokh and ACM', 1400, [
    'combinatorics',
    'dp',
    'number theory',
  ]),
  codeforcesProblem(489, 'C', 'Given Length and Sum of Digits...', 1400, [
    'dp',
    'greedy',
    'implementation',
  ]),
  codeforcesProblem(520, 'B', 'Two Buttons', 1400, [
    'dfs and similar',
    'graphs',
    'greedy',
    'implementation',
    'math',
    'shortest paths',
  ]),
  codeforcesProblem(977, 'D', 'Divide by three, multiply by two', 1400, [
    'dfs and similar',
    'math',
    'sortings',
  ]),
  codeforcesProblem(1095, 'C', 'Powers Of Two', 1400, [
    'bitmasks',
    'greedy',
  ]),
  codeforcesProblem(1154, 'C', 'Gourmet Cat', 1400, [
    'implementation',
    'math',
  ]),
  codeforcesProblem(276, 'C', 'Little Girl and Maximum Sum', 1500, [
    'data structures',
    'greedy',
    'implementation',
    'sortings',
  ]),
  codeforcesProblem(455, 'A', 'Boredom', 1500, ['dp']),
  codeforcesProblem(545, 'C', 'Woodcutters', 1500, ['dp', 'greedy']),
  codeforcesProblem(550, 'A', 'Two Substrings', 1500, [
    'brute force',
    'dp',
    'greedy',
    'implementation',
    'strings',
  ]),
  codeforcesProblem(550, 'C', 'Divisibility by Eight', 1500, [
    'brute force',
    'dp',
    'math',
  ]),
  codeforcesProblem(580, 'C', 'Kefa and Park', 1500, [
    'dfs and similar',
    'graphs',
    'trees',
  ]),
  codeforcesProblem(817, 'B', 'Makes And The Product', 1500, [
    'combinatorics',
    'implementation',
    'math',
    'sortings',
  ]),
  codeforcesProblem(839, 'C', 'Journey', 1500, [
    'dfs and similar',
    'dp',
    'graphs',
    'probabilities',
    'trees',
  ]),
  codeforcesProblem(977, 'E', 'Cyclic Components', 1500, [
    'dfs and similar',
    'dsu',
    'graphs',
  ]),
  codeforcesProblem(978, 'D', 'Almost Arithmetic Progression', 1500, [
    'brute force',
    'implementation',
    'math',
  ]),
  codeforcesProblem(1051, 'C', 'Vasya and Multisets', 1500, [
    'brute force',
    'dp',
    'greedy',
    'implementation',
    'math',
  ]),
  codeforcesProblem(371, 'C', 'Hamburgers', 1600, [
    'binary search',
    'brute force',
  ]),
  codeforcesProblem(706, 'C', 'Hard problem', 1600, ['dp', 'strings']),
  codeforcesProblem(777, 'C', 'Alyona and Spreadsheet', 1600, [
    'binary search',
    'data structures',
    'dp',
    'greedy',
    'implementation',
    'two pointers',
  ]),
  codeforcesProblem(913, 'C', 'Party Lemonade', 1600, [
    'bitmasks',
    'dp',
    'greedy',
  ]),
  codeforcesProblem(1029, 'C', 'Maximal Intersection', 1600, [
    'greedy',
    'math',
    'sortings',
  ]),
  codeforcesProblem(279, 'C', 'Ladder', 1700, [
    'dp',
    'implementation',
    'two pointers',
  ]),
  codeforcesProblem(466, 'C', 'Number of Ways', 1700, [
    'binary search',
    'brute force',
    'data structures',
    'dp',
    'two pointers',
  ]),
  codeforcesProblem(474, 'D', 'Flowers', 1700, ['dp']),
  codeforcesProblem(977, 'F', 'Consecutive Subsequence', 1700, ['dp']),
  codeforcesProblem(1042, 'C', 'Array Product', 1700, [
    'constructive algorithms',
    'greedy',
    'math',
  ]),
  codeforcesProblem(1114, 'C', "Trailing Loves (or L'oeufs?)", 1700, [
    'brute force',
    'implementation',
    'math',
    'number theory',
  ]),
  codeforcesProblem(459, 'D', "Pashmak and Parmida's problem", 1800, [
    'data structures',
    'divide and conquer',
    'sortings',
  ]),
  codeforcesProblem(888, 'E', 'Maximum Subsequence', 1800, [
    'bitmasks',
    'divide and conquer',
    'meet-in-the-middle',
  ]),
  codeforcesProblem(1030, 'D', 'Vasya and Triangle', 1800, [
    'geometry',
    'number theory',
  ]),
  // Diagnostic debts and re-solves called out in Fernando's supplied report.
  codeforcesProblem(2216, 'B', 'THU Packing Puzzle', 1300, [
    'greedy',
    'implementation',
  ]),
  codeforcesProblem(2254, 'D', 'Silhouette', 1400, [
    'constructive algorithms',
    'math',
    'sortings',
  ]),
  codeforcesProblem(2254, 'E', 'Chronostasis', 1400, [
    'binary search',
    'data structures',
    'greedy',
  ]),
  codeforcesProblem(431, 'C', 'k-Tree', 1600, [
    'dp',
    'implementation',
    'trees',
  ]),
  codeforcesProblem(1702, 'E', 'Split Into Two Sets', 1600, [
    'dfs and similar',
    'dsu',
    'graphs',
  ]),
  codeforcesProblem(2254, 'F', 'Whiplash', 1700, [
    'bitmasks',
    'constructive algorithms',
    'math',
    'sortings',
  ]),
  codeforcesProblem(1883, 'G2', 'Dances (Hard Version)', 1900, [
    'binary search',
    'sortings',
    'two pointers',
  ]),
  codeforcesProblem(2149, 'F', 'Nezuko in the Clearing', 1900, [
    'binary search',
    'math',
  ]),
  codeforcesProblem(2154, 'C2', 'No Cost Too Great (Hard Version)', 2000, [
    'math',
    'number theory',
  ]),
]

export default seedProblems
