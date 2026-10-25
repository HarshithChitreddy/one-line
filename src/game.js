import { PUZZLES } from './puzzles.js';

export function edgeKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function adjacent(a, b, size) {
  return Math.abs(Math.floor(a / size) - Math.floor(b / size)) +
    Math.abs(a % size - b % size) === 1;
}

