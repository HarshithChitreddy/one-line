import { formatTime, hintPath, isComplete, moveIssue, nextPath, pacificDayKey, practicePuzzle, puzzleForDay, shareableGameUrl } from './game.js';

const $ = selector => document.querySelector(selector);
const grid = $('#grid');
let today = pacificDayKey();
const dateLabel = () => new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${today}T00:00:00Z`));
let mode = 'daily';
let practiceIndex = Number(read('one-line-practice-index') || 0);
if (!Number.isSafeInteger(practiceIndex) || practiceIndex < 0) practiceIndex = 0;
let puzzle;
let path = [];
let seconds = 0;
let hints = 0;
let completed = false;
let dragging = false;
let focusIndex = 0;
let cells = [];
let timerAnchor = performance.now();
let pendingMilliseconds = 0;

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Game remains playable without storage. */ }
}

function stateKey() {
  return mode === 'daily' ? `one-line-daily-${today}` : `one-line-practice-${puzzle.id}`;
}

function save() {
  write(stateKey(), JSON.stringify({ puzzleId: puzzle.id, path, seconds, hints, completed }));
}

function restore() {
  path = [];
  seconds = 0;
  hints = 0;
  completed = false;
  try {
    const saved = JSON.parse(read(stateKey()) || 'null');
    if (saved?.puzzleId !== puzzle.id || !Array.isArray(saved.path)) return;
    let checked = [];
    for (const cell of saved.path) {
      const next = nextPath(puzzle, checked, cell);
      if (next.length !== checked.length + 1) return;
      checked = next;
    }
    path = checked;
    seconds = Number.isInteger(saved.seconds) && saved.seconds >= 0 ? saved.seconds : 0;
    hints = Number.isInteger(saved.hints) && saved.hints >= 0 ? saved.hints : 0;
    completed = isComplete(puzzle, path);
  } catch { /* Ignore invalid saved data. */ }
}

function buildBoard() {
  grid.innerHTML = '';
  cells = [];
  const wallSet = new Set(puzzle.walls.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`));
  const hasWall = (a, b) => wallSet.has(`${Math.min(a, b)}-${Math.max(a, b)}`);
  for (let index = 0; index < puzzle.size ** 2; index++) {
    const row = Math.floor(index / puzzle.size);
    const col = index % puzzle.size;
    const clueIndex = puzzle.clues.indexOf(index);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.cell = String(index);
    cell.tabIndex = -1;
    if (clueIndex === 0) cell.classList.add('start');
    if (clueIndex === puzzle.clues.length - 1) cell.classList.add('end');
    if (col < puzzle.size - 1 && hasWall(index, index + 1)) cell.classList.add('wall-right');
    if (row < puzzle.size - 1 && hasWall(index, index + puzzle.size)) cell.classList.add('wall-bottom');
    const walls = [];
    if (row > 0 && hasWall(index, index - puzzle.size)) walls.push('up');
    if (col < puzzle.size - 1 && hasWall(index, index + 1)) walls.push('right');
    if (row < puzzle.size - 1 && hasWall(index, index + puzzle.size)) walls.push('down');
    if (col > 0 && hasWall(index, index - 1)) walls.push('left');
    cell.dataset.walls = walls.join(', ');
    if (clueIndex >= 0) {
      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = String(clueIndex + 1);
      cell.append(number);
    }
    grid.append(cell);
    cells.push(cell);
  }
  focusIndex = puzzle.clues[0];
}

function dailyStreak() {
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00Z`);
  for (let i = 0; i < 366; i++) {
    const key = cursor.toISOString().slice(0, 10);
    let solved = false;
    try { solved = JSON.parse(read(`one-line-daily-${key}`) || 'null')?.completed === true; } catch { /* Ignore invalid saved data. */ }
    if (!solved) {
      if (i === 0) { cursor.setUTCDate(cursor.getUTCDate() - 1); continue; }
      break;
    }
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function updateRecord() {
  const streak = dailyStreak();
  $('#record-title').textContent = streak ? `${streak} day${streak === 1 ? '' : 's'} in a row` : 'A fresh start';
  $('#record-copy').textContent = streak ? 'Your daily puzzle streak is growing.' : 'Finish today’s puzzle to begin your streak.';
}

function render() {
  const total = puzzle.size ** 2;
  const visited = puzzle.clues.filter(clue => path.includes(clue)).length;
  cells.forEach((cell, index) => {
    const position = path.indexOf(index);
    cell.classList.toggle('in-path', position >= 0);
    cell.classList.toggle('current', index === path.at(-1));
    cell.setAttribute('aria-label', `Row ${Math.floor(index / puzzle.size) + 1}, column ${index % puzzle.size + 1}${puzzle.clues.includes(index) ? `, number ${puzzle.clues.indexOf(index) + 1}` : ''}${position >= 0 ? ', in path' : ''}${cell.dataset.walls ? `, walls ${cell.dataset.walls}` : ''}`);
    cell.tabIndex = index === focusIndex ? 0 : -1;
  });
  $('#path-line').setAttribute('points', path.map(index => `${index % puzzle.size + .5},${Math.floor(index / puzzle.size) + .5}`).join(' '));
  $('#progress-label').textContent = `${path.length} of ${total} squares`;
  $('#next-number').textContent = completed ? 'Complete!' : !path.length ? 'Start at 1' : visited < puzzle.clues.length ? `Next: ${visited + 1}` : 'Fill the remaining squares';
  $('#progress-fill').style.width = `${path.length / total * 100}%`;
  $('#timer').textContent = formatTime(seconds);
  $('#undo-button').disabled = !path.length || completed;
  $('#hint-button').disabled = completed;
  $('#reset-button').disabled = completed;
  $('#completion').hidden = !completed;
  $('#completion-copy').textContent = `Solved in ${formatTime(seconds)}${hints ? ` with ${hints} hint${hints === 1 ? '' : 's'}` : ' without hints'}.`;
  $('#next-button').hidden = mode !== 'practice';
  updateRecord();
}

function announce(message) {
  $('#announcement').textContent = message;
}

function advanceTimer() {
  const now = performance.now();
  const delta = Math.max(0, now - timerAnchor);
  timerAnchor = now;
  if (!path.length || completed || document.hidden) {
    pendingMilliseconds = 0;
    return;
  }
  pendingMilliseconds += delta;
  const elapsed = Math.floor(pendingMilliseconds / 1000);
  if (!elapsed) return;
  pendingMilliseconds -= elapsed * 1000;
  seconds += elapsed;
  $('#timer').textContent = formatTime(seconds);
  save();
}

function applyCell(index, reportInvalid = false) {
  if (completed) return;
  const next = nextPath(puzzle, path, index);
  if (next === path) {
    if (reportInvalid) announce(moveIssue(puzzle, path, index));
    return;
  }
  if (!path.length) {
    timerAnchor = performance.now();
    pendingMilliseconds = 0;
  }
  if (isComplete(puzzle, next)) advanceTimer();
  path = next;
  if (isComplete(puzzle, path)) {
    completed = true;
    announce(`Puzzle complete in ${formatTime(seconds)}.`);
  }
  save();
  render();
}

function choose(modeName) {
  mode = modeName;
  puzzle = mode === 'daily' ? puzzleForDay(today) : practicePuzzle(practiceIndex);
  $('#daily-tab').classList.toggle('active', mode === 'daily');
  $('#practice-tab').classList.toggle('active', mode === 'practice');
  if (mode === 'daily') {
    $('#daily-tab').setAttribute('aria-current', 'page');
    $('#practice-tab').removeAttribute('aria-current');
  } else {
    $('#practice-tab').setAttribute('aria-current', 'page');
    $('#daily-tab').removeAttribute('aria-current');
  }
  $('#puzzle-kicker').textContent = mode === 'daily' ? `${dateLabel().toUpperCase()} · DAILY PUZZLE` : `PRACTICE PUZZLE ${practiceIndex + 1}`;
  $('#puzzle-heading').textContent = mode === 'daily' ? 'The daily line' : 'Keep going';
  restore();
  timerAnchor = performance.now();
  pendingMilliseconds = 0;
  buildBoard();
  render();
  announce(mode === 'daily' ? `Daily puzzle for ${dateLabel()}.` : `Practice puzzle ${practiceIndex + 1}.`);
}

grid.addEventListener('pointerdown', event => {
  const cell = event.target.closest('[data-cell]');
  if (!cell) return;
  event.preventDefault();
  dragging = true;
  focusIndex = Number(cell.dataset.cell);
  cell.focus();
  applyCell(focusIndex, true);
});

window.addEventListener('pointermove', event => {
  if (!dragging) return;
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-cell]');
  if (cell && grid.contains(cell)) applyCell(Number(cell.dataset.cell));
});
window.addEventListener('pointerup', () => { dragging = false; });
window.addEventListener('pointercancel', () => { dragging = false; });
grid.addEventListener('click', event => {
  if (event.detail !== 0) return;
  const cell = event.target.closest('[data-cell]');
  if (cell) applyCell(Number(cell.dataset.cell), true);
});

grid.addEventListener('keydown', event => {
  const deltas = { ArrowUp: -puzzle.size, ArrowDown: puzzle.size, ArrowLeft: -1, ArrowRight: 1 };
  if (event.key in deltas) {
    event.preventDefault();
    const from = path.length ? path.at(-1) : focusIndex;
    const target = from + deltas[event.key];
    if (target >= 0 && target < puzzle.size ** 2 && Math.abs(Math.floor(target / puzzle.size) - Math.floor(from / puzzle.size)) + Math.abs(target % puzzle.size - from % puzzle.size) === 1) {
      if (path.length) applyCell(target, true);
      focusIndex = target;
      cells[target].focus();
      render();
    }
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    applyCell(Number(document.activeElement?.dataset.cell ?? focusIndex), true);
  } else if (event.key === 'Backspace') {
    event.preventDefault();
    $('#undo-button').click();
  }
});

