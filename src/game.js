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

