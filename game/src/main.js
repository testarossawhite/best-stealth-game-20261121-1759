// GLOAMING ARCHIVE — the entry point: canvas, keyboard and mouse, the fixed-
// step loop, and the screen flow. The simulation lives in engine.js and every
// pixel in render.js; this file only connects them to the player.

import { VIEW_W, VIEW_H, TILE, FIELD_X, FIELD_Y, STEP } from './config.js';
import { Game, SCREEN } from './engine.js';
import { render } from './render.js';
import { initAudio, setMuted, isMuted, sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const game = new Game();
window.__gloaming = game;

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

const keys = new Set();
let mouse = { x: 0, y: 0 };

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
    y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
  };
}

canvas.addEventListener('mousemove', (event) => {
  mouse = canvasPoint(event);
});

canvas.addEventListener('mousedown', (event) => {
  initAudio();
  const p = canvasPoint(event);
  if (game.screen === SCREEN.PLAY) {
    const tx = (p.x - FIELD_X) / TILE;
    const ty = (p.y - FIELD_Y) / TILE;
    game.tossPebble(tx, ty);
    return;
  }
  if (game.screen === SCREEN.TITLE) {
    // The parchment panel is 880x560 centred; its difficulty boxes and the
    // start line are clickable as well as keyed (see render.js drawTitle).
    const panelX = (VIEW_W - 880) / 2;
    const panelY = (VIEW_H - 560) / 2;
    const keys = ['candle', 'lantern', 'gloaming'];
    keys.forEach((key, i) => {
      const bx = panelX + 48 + i * 196;
      const by = panelY + 436;
      if (p.x >= bx && p.x <= bx + 178 && p.y >= by && p.y <= by + 40) {
        game.difficultyKey = key;
        sfx.select();
      }
    });
    if (p.y >= panelY + 500 && p.y <= panelY + 528) {
      if (p.x < VIEW_W / 2) { game.startCampaign(game.difficultyKey); sfx.select(); }
      else { game.startEndless(); sfx.select(); }
    }
  }
});

window.addEventListener('keydown', (event) => {
  initAudio();
  const k = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) event.preventDefault();
  keys.add(k);
  if (k === 'm') {
    setMuted(!isMuted());
    return;
  }
  switch (game.screen) {
    case SCREEN.TITLE:
      if (k === '1') { game.difficultyKey = 'candle'; sfx.select(); }
      else if (k === '2') { game.difficultyKey = 'lantern'; sfx.select(); }
      else if (k === '3') { game.difficultyKey = 'gloaming'; sfx.select(); }
      else if (k === 'enter') { game.startCampaign(game.difficultyKey); sfx.select(); }
      else if (k === 'e') { game.startEndless(); sfx.select(); }
      break;
    case SCREEN.INTRO:
      if (k === 'enter') game.screen = SCREEN.PLAY;
      break;
    case SCREEN.PLAY:
      if (k === 'p') game.screen = SCREEN.PAUSED;
      else if (k === 'r') game.retryLevel();
      break;
    case SCREEN.PAUSED:
      if (k === 'p' || k === 'enter') game.screen = SCREEN.PLAY;
      break;
    case SCREEN.CAUGHT:
      if (k === 'enter' || k === 'r') {
        if (game.endless) game.finishEndless();
        else game.retryLevel();
      }
      break;
    case SCREEN.CLEAR:
      if (k === 'enter') game.nextLevel();
      break;
    case SCREEN.RESULTS:
      if (k === 'enter') {
        game.loadLevel(0, game.difficultyKey);
        game.screen = SCREEN.TITLE;
      }
      break;
    default:
      break;
  }
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});

function currentInput() {
  let mx = 0;
  let my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  return { mx, my, sneak: keys.has('shift') };
}

let lastStatus = '';
function announce() {
  const text = `${game.screen} — ${game.levelDef.name}, pages ${game.pagesGot} of ${game.pages.length}, score ${game.endless ? game.endlessScore : game.campaignScore}`;
  if (text !== lastStatus) {
    lastStatus = text;
    if (status) status.textContent = text;
  }
}

if (shotName) {
  // Screenshot mode: stage the named scene, render it at a fixed instant so
  // every capture of the same scene is the same frame, and flag readiness.
  import('./shots.js').then(({ stageShot }) => {
    stageShot(shotName, game);
    const FIXED_T = 2.35;
    let frames = 0;
    const draw = () => {
      render(ctx, game, FIXED_T);
      frames += 1;
      if (frames > 4) {
        window.__shotReady = shotName;
        return;
      }
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  });
} else {
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    const input = currentInput();
    while (acc >= STEP) {
      game.update(STEP, input);
      acc -= STEP;
    }
    ctx.save();
    if (game.shake > 0) {
      const s = game.shake * 5;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    render(ctx, game, now / 1000);
    ctx.restore();
    announce();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
