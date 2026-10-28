import { PUZZLES } from './puzzles.js';

export function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function adjacent(a, b, size) {
  return Math.abs(Math.floor(a / size) - Math.floor(b / size)) +
    Math.abs(a % size - b % size) === 1;
}

export function transformCell(index, size, variant) {
  let row = Math.floor(index / size);
  let col = index % size;
  if (variant & 4) col = size - 1 - col;
  for (let turn = 0; turn < (variant & 3); turn++) {
    [row, col] = [col, size - 1 - row];
  }
  return row * size + col;
}

export function transformPuzzle(base, variant, reverse = false) {
  const map = index => transformCell(index, base.size, variant);
  const solution = base.solution.map(map);
  const clues = base.clues.map(map);
  if (reverse) {
    solution.reverse();
    clues.reverse();
  }
  return {
    id: `${base.id}-${variant}-${reverse ? 1 : 0}`,
    size: base.size,
    clues,
    walls: base.walls.map(([a, b]) => [map(a), map(b)]),
    solution,
  };
}

// Keep only distinct boards. Different source paths can produce the same visible puzzle.
const VARIANTS = (() => {
  const seen = new Set();
  const result = [];
  for (const reverse of [false, true]) {
    for (let variant = 0; variant < 8; variant++) {
      for (const base of PUZZLES) {
        const puzzle = transformPuzzle(base, variant, reverse);
        const signature = `${puzzle.clues.join(',')}|${puzzle.walls.map(([a, b]) => edgeKey(a, b)).sort().join(',')}`;
        if (seen.has(signature)) continue;
        seen.add(signature);
        result.push({ base, variant, reverse });
      }
    }
  }
  return result;
})();

export const PUZZLE_COUNT = VARIANTS.length;

function selectedPuzzle(index) {
  if (!Number.isSafeInteger(index)) throw new Error('Invalid puzzle index');
  const safe = ((index % PUZZLE_COUNT) + PUZZLE_COUNT) % PUZZLE_COUNT;
  const { base, variant, reverse } = VARIANTS[safe];
  return transformPuzzle(base, variant, reverse);
}

const EPOCH_DAY = Math.floor(Date.UTC(2026, 9, 31) / 86400000);

export function pacificDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function puzzleForDay(dateKey) {
  const timestamp = /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? Date.parse(`${dateKey}T00:00:00Z`) : NaN;
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== dateKey) throw new Error('Invalid date');
  const day = Math.floor(timestamp / 86400000) - EPOCH_DAY;
  return selectedPuzzle(day);
}

export function practicePuzzle(index) {
  return selectedPuzzle(index);
}

export function validatePuzzle(puzzle) {
  const total = puzzle.size * puzzle.size;
  const { solution, clues, walls } = puzzle;
  if (solution.length !== total || new Set(solution).size !== total) return false;
  if (solution.some(index => !Number.isInteger(index) || index < 0 || index >= total)) return false;
  if (clues.length < 2 || clues[0] !== solution[0] || clues.at(-1) !== solution.at(-1)) return false;
  const wallSet = new Set(walls.map(([a, b]) => edgeKey(a, b)));
  if (walls.some(([a, b]) => !adjacent(a, b, puzzle.size))) return false;
  for (let i = 1; i < total; i++) {
    if (!adjacent(solution[i - 1], solution[i], puzzle.size) || wallSet.has(edgeKey(solution[i - 1], solution[i]))) return false;
  }
  let previous = -1;
  for (const clue of clues) {
    const position = solution.indexOf(clue);
    if (position <= previous) return false;
    previous = position;
  }
  return true;
}

export function nextPath(puzzle, path, cell) {
  const total = puzzle.size * puzzle.size;
  if (!Number.isInteger(cell) || cell < 0 || cell >= total) return path;
  if (!path.length) return cell === puzzle.clues[0] ? [cell] : path;
  const previousIndex = path.indexOf(cell);
  if (previousIndex >= 0) return path.slice(0, previousIndex + 1);
  const last = path.at(-1);
  if (!adjacent(last, cell, puzzle.size)) return path;
  if (puzzle.walls.some(([a, b]) => edgeKey(a, b) === edgeKey(last, cell))) return path;
  const clueIndex = puzzle.clues.indexOf(cell);
  if (clueIndex >= 0) {
    const visitedClues = puzzle.clues.filter(clue => path.includes(clue)).length;
    if (clueIndex !== visitedClues) return path;
    if (clueIndex === puzzle.clues.length - 1 && path.length !== total - 1) return path;
  }
  return [...path, cell];
}

export function moveIssue(puzzle, path, cell) {
  const total = puzzle.size * puzzle.size;
  if (!Number.isInteger(cell) || cell < 0 || cell >= total) return 'Choose a square in the grid.';
  if (!path.length) return cell === puzzle.clues[0] ? '' : 'Start at number 1.';
  if (path.includes(cell)) return '';
  const last = path.at(-1);
  if (!adjacent(last, cell, puzzle.size)) return 'Choose a neighboring square.';
  if (puzzle.walls.some(([a, b]) => edgeKey(a, b) === edgeKey(last, cell))) return 'A wall blocks that move.';
  const clueIndex = puzzle.clues.indexOf(cell);
  if (clueIndex >= 0) {
    const nextClue = puzzle.clues.filter(clue => path.includes(clue)).length;
    if (clueIndex !== nextClue) return `Visit number ${nextClue + 1} next.`;
    if (clueIndex === puzzle.clues.length - 1 && path.length !== total - 1) return 'Fill every square before the last number.';
  }
  return '';
}

export function isComplete(puzzle, path) {
  const total = puzzle.size * puzzle.size;
  if (path.length !== total || path[0] !== puzzle.clues[0] || path.at(-1) !== puzzle.clues.at(-1) || new Set(path).size !== total) return false;
  const walls = new Set(puzzle.walls.map(([a, b]) => edgeKey(a, b)));
  let nextClue = 0;
  for (let i = 0; i < path.length; i++) {
    const clue = puzzle.clues.indexOf(path[i]);
    if (clue >= 0) {
      if (clue !== nextClue) return false;
      nextClue++;
    }
    if (i && (!adjacent(path[i - 1], path[i], puzzle.size) || walls.has(edgeKey(path[i - 1], path[i])))) return false;
  }
  return nextClue === puzzle.clues.length;
}

export function hintPath(puzzle, path) {
  const firstWrong = path.findIndex((cell, index) => cell !== puzzle.solution[index]);
  const correctLength = firstWrong < 0 ? path.length : firstWrong;
  if (correctLength >= puzzle.solution.length) return path;
  return puzzle.solution.slice(0, correctLength + 1);
}

