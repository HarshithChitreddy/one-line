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

