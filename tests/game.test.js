import test from 'node:test';
import assert from 'node:assert/strict';
import { PUZZLES } from '../src/puzzles.js';
import { adjacent, hintPath, isComplete, nextPath, pacificDayKey, practicePuzzle, puzzleForDay, transformPuzzle, validatePuzzle } from '../src/game.js';

test('every catalog board and its rotations are valid', () => {
  assert.equal(PUZZLES.length, 64);
  for (const base of PUZZLES) {
    assert.ok(validatePuzzle(base), `base ${base.id}`);
    for (let variant = 0; variant < 8; variant++) {
      assert.ok(validatePuzzle(transformPuzzle(base, variant)), `${base.id} variant ${variant}`);
      assert.ok(validatePuzzle(transformPuzzle(base, variant, true)), `${base.id} variant ${variant} reversed`);
    }
  }
});

test('a full solution can be played and completes exactly at the last square', () => {
  for (const base of PUZZLES) {
    let path = [];
    for (const cell of base.solution) path = nextPath(base, path, cell);
    assert.deepEqual(path, base.solution);
    assert.ok(isComplete(base, path));
    assert.equal(isComplete(base, path.slice(0, -1)), false);
  }
});

test('completion rejects forged paths with repeated or nonadjacent cells', () => {
  const puzzle = PUZZLES[0];
  const repeated = [...puzzle.solution];
  repeated[5] = repeated[4];
  assert.equal(isComplete(puzzle, repeated), false);
  const scrambled = [...puzzle.solution];
  [scrambled[3], scrambled[4]] = [scrambled[4], scrambled[3]];
  assert.equal(isComplete(puzzle, scrambled), false);
});

test('movement rejects skips, walls, and numbered cells out of order', () => {
  const puzzle = PUZZLES.find(item => item.walls.length > 0);
  assert.deepEqual(nextPath(puzzle, [], puzzle.clues[1]), []);
  const start = puzzle.clues[0];
  assert.deepEqual(nextPath(puzzle, [start], (start + 2) % 25), [start]);
  const first = puzzle.solution.slice(0, 3);
  assert.deepEqual(nextPath(puzzle, first, first[1]), first.slice(0, 2));
  const [a, b] = puzzle.walls[0];
  assert.ok(adjacent(a, b, puzzle.size));
  assert.deepEqual(nextPath(puzzle, [a], b), [a]);
  const futureClue = puzzle.clues[2];
  assert.deepEqual(nextPath(puzzle, [start], futureClue), [start]);
});

test('hint trims a wrong branch and reveals the next correct cell', () => {
  const branch = PUZZLES.flatMap(puzzle => puzzle.solution.slice(0, -1).map((_, index) => {
    const correct = puzzle.solution.slice(0, index + 1);
    const wrong = Array.from({ length: 25 }, (_, cell) => cell).find(cell => cell !== puzzle.solution[index + 1] && nextPath(puzzle, correct, cell).length === correct.length + 1);
    return wrong === undefined ? null : { puzzle, correct, wrong };
  })).find(Boolean);
  assert.ok(branch);
  const { puzzle, correct, wrong } = branch;
  assert.deepEqual(hintPath(puzzle, [...correct, wrong]), puzzle.solution.slice(0, correct.length + 1));
  assert.deepEqual(hintPath(puzzle, []), [puzzle.solution[0]]);
});

test('daily selection is stable and practice advances', () => {
  assert.deepEqual(puzzleForDay('2026-10-31'), puzzleForDay('2026-10-31'));
  assert.notEqual(puzzleForDay('2026-10-31').id, puzzleForDay('2026-11-01').id);
  assert.notEqual(practicePuzzle(0).id, practicePuzzle(1).id);
  assert.throws(() => puzzleForDay('2026-02-30'), /Invalid date/);
  assert.throws(() => practicePuzzle(NaN), /Invalid puzzle index/);
});

test('the daily date changes at midnight Pacific', () => {
  assert.equal(pacificDayKey(new Date('2026-11-01T06:59:59Z')), '2026-10-31');
  assert.equal(pacificDayKey(new Date('2026-11-01T07:00:00Z')), '2026-11-01');
});
