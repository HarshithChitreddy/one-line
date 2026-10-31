import test from 'node:test';
import assert from 'node:assert/strict';
import { PUZZLES } from '../src/puzzles.js';
import { PUZZLE_COUNT, formatTime, moveIssue, nextPath, pacificDayKey, practicePuzzle, puzzleForDay, shareableGameUrl } from '../src/game.js';

// Independent search: count paths using only the displayed clues and walls.
function countSolutions(puzzle, limit = 2) {
  const total = puzzle.size ** 2;
  const marks = new Int8Array(total).fill(-1);
  puzzle.clues.forEach((cell, index) => { marks[cell] = index; });
  const blocked = new Set(puzzle.walls.map(([a, b]) => [a, b].sort((x, y) => x - y).join('-')));
  const neighbors = Array.from({ length: total }, (_, cell) => {
    const row = Math.floor(cell / puzzle.size);
    const col = cell % puzzle.size;
    return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
      .filter(([r, c]) => r >= 0 && c >= 0 && r < puzzle.size && c < puzzle.size)
      .map(([r, c]) => r * puzzle.size + c)
      .filter(other => !blocked.has([cell, other].sort((a, b) => a - b).join('-')));
  });
  let solutions = 0;

  function remainingConnected(mask) {
    const remaining = Array.from({ length: total }, (_, i) => i).filter(i => !(mask & (1 << i)));
    if (!remaining.length) return true;
    const seen = new Set([remaining[0]]);
    const stack = [remaining[0]];
    while (stack.length) {
      for (const next of neighbors[stack.pop()]) {
        if (!(mask & (1 << next)) && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return seen.size === remaining.length;
  }

  function search(cell, mask, length, nextMark) {
    if (solutions >= limit) return;
    if (length === total) {
      if (cell === puzzle.clues.at(-1) && nextMark === puzzle.clues.length) solutions++;
      return;
    }
    if (cell === puzzle.clues.at(-1)) return;
    for (const next of neighbors[cell]) {
      if (mask & (1 << next)) continue;
      if (marks[next] >= 0 && marks[next] !== nextMark) continue;
      const nextMask = mask | (1 << next);
      if (!remainingConnected(nextMask)) continue;
      search(next, nextMask, length + 1, nextMark + (marks[next] === nextMark ? 1 : 0));
    }
  }

  search(puzzle.clues[0], 1 << puzzle.clues[0], 1, 1);
  return solutions;
}

function visibleSignature(puzzle) {
  return `${puzzle.clues.join(',')}|${puzzle.walls.map(([a, b]) => [a, b].sort((x, y) => x - y).join('-')).sort().join(',')}`;
}

test('each original board has exactly one solution', () => {
  for (const puzzle of PUZZLES) assert.equal(countSolutions(puzzle), 1, `board ${puzzle.id}`);
});

test('the daily cycle contains no duplicate visible boards', () => {
  assert.equal(PUZZLE_COUNT, 840);
  const seen = new Set();
  const start = Date.UTC(2026, 9, 31);
  for (let day = 0; day < PUZZLE_COUNT; day++) {
    const key = new Date(start + day * 86400000).toISOString().slice(0, 10);
    const signature = visibleSignature(puzzleForDay(key));
    assert.ok(!seen.has(signature), `duplicate on day ${day}`);
    seen.add(signature);
  }
  assert.notEqual(visibleSignature(practicePuzzle(0)), visibleSignature(practicePuzzle(1)));
});

test('legal moves preserve the full rule set across random action sequences', () => {
  let seed = 0x51c0ffee;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (const puzzle of PUZZLES) {
    const wallSet = new Set(puzzle.walls.map(([a, b]) => [a, b].sort((x, y) => x - y).join('-')));
    for (let round = 0; round < 20; round++) {
      let path = puzzle.solution.slice(0, random() % 25);
      for (let step = 0; step < 50; step++) {
        path = nextPath(puzzle, path, random() % 25);
        assert.equal(new Set(path).size, path.length);
        if (!path.length) continue;
        assert.equal(path[0], puzzle.clues[0]);
        const visitedMarks = puzzle.clues.filter(cell => path.includes(cell));
        assert.deepEqual(visitedMarks, puzzle.clues.slice(0, visitedMarks.length));
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1], b = path[i];
          assert.equal(Math.abs(Math.floor(a / 5) - Math.floor(b / 5)) + Math.abs(a % 5 - b % 5), 1);
          assert.ok(!wallSet.has([a, b].sort((x, y) => x - y).join('-')));
        }
        if (path.includes(puzzle.clues.at(-1))) assert.equal(path.length, 25);
      }
    }
  }
});

test('Pacific reset remains correct across spring and fall DST', () => {
  assert.equal(pacificDayKey(new Date('2027-03-14T07:59:59Z')), '2027-03-13');
  assert.equal(pacificDayKey(new Date('2027-03-14T08:00:00Z')), '2027-03-14');
  assert.equal(pacificDayKey(new Date('2026-11-01T06:59:59Z')), '2026-10-31');
  assert.equal(pacificDayKey(new Date('2026-11-01T07:00:00Z')), '2026-11-01');
});

test('shared results omit private local paths and URL parameters', () => {
  assert.equal(shareableGameUrl('file:///Users/person/one-line/index.html'), '');
  assert.equal(shareableGameUrl('http://127.0.0.1:4173/'), '');
  assert.equal(shareableGameUrl('not a URL'), '');
  assert.equal(shareableGameUrl('https://person.github.io/one-line/?token=secret#level'), 'https://person.github.io/one-line/');
});

test('invalid input has a useful explanation', () => {
  const puzzle = PUZZLES.find(board => board.walls.length);
  assert.equal(moveIssue(puzzle, [], puzzle.clues[1]), 'Start at number 1.');
  assert.equal(moveIssue(puzzle, [puzzle.clues[0]], -1), 'Choose a square in the grid.');
  const [a, b] = puzzle.walls[0];
  assert.equal(moveIssue(puzzle, [a], b), 'A wall blocks that move.');
  const simple = { size: 3, clues: [0, 4, 8], walls: [] };
  assert.equal(moveIssue(simple, [0, 1, 2, 5], 8), 'Visit number 2 next.');
  assert.equal(moveIssue({ ...simple, clues: [0, 2, 8] }, [0, 1, 2, 5], 8), 'Fill every square before the last number.');
  assert.equal(moveIssue(simple, [0, 1], 2), '');
});

test('time formatting handles minute and hour boundaries', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(59), '00:59');
  assert.equal(formatTime(60), '01:00');
  assert.equal(formatTime(3600), '60:00');
});
