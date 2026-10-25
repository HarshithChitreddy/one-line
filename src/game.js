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

