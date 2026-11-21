// GLOAMING ARCHIVE — every pixel. Canvas 2D in one identity: ink-navy dark,
// warm amber lantern pools, parchment panels, serif display type. The world is
// drawn lit, then a darkness sheet with lantern holes is laid over it, then
// the wardens' vision cones and the figures themselves — so light and shadow
// are things you can see, not just numbers in the engine.

import {
  VIEW_W, VIEW_H, TILE, COLS, ROWS, FIELD_X, FIELD_Y, PANEL_X, PANEL_W,
  INK, SPINES, DIFFICULTIES, CONE_RAYS,
} from './config.js';
import { LEVELS } from './levels.js';
import { SCREEN, angleWrap, makeRng } from './engine.js';
import { isMuted } from './audio.js';

const SERIF = 'Georgia, "Times New Roman", serif';

let lightCanvas = null;
let decorCache = new Map();

function tilePx(tx) { return FIELD_X + tx * TILE; }
function tilePy(ty) { return FIELD_Y + ty * TILE; }
export function worldToPx(x, y) { return { px: FIELD_X + x * TILE, py: FIELD_Y + y * TILE }; }

/** Deterministic per-chamber decoration: book spines and floor flecks. */
function decorFor(game) {
  const key = (game.endless ? 'e' : 'c') + game.levelIndex;
  if (decorCache.has(key)) return decorCache.get(key);
  const rng = makeRng(1234 + game.levelIndex * 777 + (game.endless ? 55 : 0));
  const spines = new Map();
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (game.tileAt(x, y) !== '#') continue;
      const books = [];
      let bx = 2;
      while (bx < TILE - 4) {
        const w = 2 + Math.floor(rng() * 3);
        books.push({ off: bx, w, c: SPINES[Math.floor(rng() * SPINES.length)], h: 9 + Math.floor(rng() * 7), lean: rng() < 0.12 });
        bx += w + 1;
      }
      spines.set(x + ',' + y, books);
    }
  }
  const flecks = [];
  for (let i = 0; i < 260; i += 1) {
    flecks.push({ x: rng() * COLS, y: rng() * ROWS, r: 0.6 + rng() * 1.6, a: 0.03 + rng() * 0.06 });
  }
  const decor = { spines, flecks };
  decorCache.set(key, decor);
  return decor;
}

export function resetDecorCache() {
  decorCache = new Map();
}

// ------------------------------------------------------------------ world

function drawFloor(ctx, game, decor) {
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? INK.floorA : INK.floorB;
      ctx.fillRect(tilePx(x), tilePy(y), TILE, TILE);
    }
  }
  ctx.fillStyle = '#ffffff';
  for (const f of decor.flecks) {
    ctx.globalAlpha = f.a;
    ctx.beginPath();
    ctx.arc(FIELD_X + f.x * TILE, FIELD_Y + f.y * TILE, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = INK.floorLine;
  ctx.lineWidth = 1;
  for (let x = 0; x <= COLS; x += 1) {
    ctx.beginPath(); ctx.moveTo(tilePx(x), FIELD_Y); ctx.lineTo(tilePx(x), FIELD_Y + ROWS * TILE); ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    ctx.beginPath(); ctx.moveTo(FIELD_X, tilePy(y)); ctx.lineTo(FIELD_X + COLS * TILE, tilePy(y)); ctx.stroke();
  }
}

function drawShelf(ctx, game, decor, x, y) {
  const px = tilePx(x);
  const py = tilePy(y);
  ctx.fillStyle = INK.shelfWood;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = INK.shelfEdge;
  ctx.fillRect(px, py, TILE, 3);
  ctx.fillRect(px, py + TILE - 3, TILE, 3);
  const books = decor.spines.get(x + ',' + y) || [];
  for (const row of [0, 1]) {
    const baseY = py + (row === 0 ? 15 : 29);
    for (const b of books) {
      ctx.fillStyle = b.c;
      const h = row === 0 ? b.h : Math.max(7, b.h - 2);
      if (b.lean) {
        ctx.save();
        ctx.translate(px + b.off, baseY);
        ctx.rotate(0.16);
        ctx.fillRect(0, -h, b.w, h);
        ctx.restore();
      } else {
        ctx.fillRect(px + b.off, baseY - h, b.w, h);
      }
    }
  }
}

function drawDesk(ctx, x, y) {
  const px = tilePx(x);
  const py = tilePy(y);
  ctx.fillStyle = '#4a341f';
  ctx.fillRect(px + 1, py + 4, TILE - 2, TILE - 8);
  ctx.fillStyle = '#6b4e2c';
  ctx.fillRect(px + 3, py + 6, TILE - 6, TILE - 12);
  ctx.fillStyle = INK.parchment;
  ctx.fillRect(px + 9, py + 11, 9, 6);
  ctx.fillRect(px + 19, py + 17, 7, 5);
  ctx.fillStyle = INK.amberDeep;
  ctx.fillRect(px + 24, py + 8, 3, 3);
}

function drawCurtain(ctx, x, y, t) {
  const px = tilePx(x);
  const py = tilePy(y);
  ctx.fillStyle = '#571f26';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.fillStyle = '#6e2831';
  for (let i = 0; i < 4; i += 1) {
    const sway = Math.sin(t * 1.3 + x + i) * 1.2;
    ctx.fillRect(px + 3 + i * 8 + sway, py, 4, TILE);
  }
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(px, py, TILE, 3);
}

function drawGrass(ctx, x, y, t) {
  const px = tilePx(x);
  const py = tilePy(y);
  ctx.fillStyle = '#0d2a22';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = INK.grass;
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i += 1) {
    const bx = px + 4 + i * 5;
    const sway = Math.sin(t * 1.8 + x * 3 + y + i * 1.7) * 2;
    ctx.beginPath();
    ctx.moveTo(bx, py + TILE - 2);
    ctx.quadraticCurveTo(bx + sway, py + 14, bx + sway * 1.6, py + 5 + (i % 3) * 3);
    ctx.stroke();
  }
}

function drawExit(ctx, game, t) {
  if (!game.exit) return;
  const { px, py } = worldToPx(game.exit.x, game.exit.y);
  const open = game.pagesGot >= game.pages.length;
  const pulse = 0.6 + 0.4 * Math.sin(t * 3);
  ctx.fillStyle = '#12241c';
  ctx.fillRect(px - TILE / 2, py - TILE / 2, TILE, TILE);
  ctx.strokeStyle = open ? INK.exitGlow : '#3a5a48';
  ctx.lineWidth = 2;
  ctx.strokeRect(px - TILE / 2 + 3, py - TILE / 2 + 3, TILE - 6, TILE - 6);
  ctx.fillStyle = open ? INK.exitGlow : '#41604e';
  ctx.globalAlpha = open ? pulse : 0.55;
  for (let i = 0; i < 3; i += 1) {
    const w = 18 - i * 5;
    ctx.fillRect(px - w / 2, py + 8 - i * 6, w, 3);
  }
  ctx.globalAlpha = 1;
  ctx.font = `bold 9px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = open ? INK.exitGlow : '#5a7a68';
  ctx.fillText(open ? 'EXIT' : 'SEALED', px, py - TILE / 2 + 10);
}

function drawPage(ctx, pg, t) {
  if (pg.taken) return;
  const { px, py } = worldToPx(pg.x, pg.y);
  const bobY = Math.sin(t * 2.2 + pg.bob) * 2.5;
  const glow = ctx.createRadialGradient(px, py + bobY, 1, px, py + bobY, 17);
  glow.addColorStop(0, 'rgba(255,233,168,0.5)');
  glow.addColorStop(1, 'rgba(255,233,168,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(px - 17, py + bobY - 17, 34, 34);
  ctx.save();
  ctx.translate(px, py + bobY);
  ctx.rotate(Math.sin(t * 1.7 + pg.bob) * 0.18);
  ctx.fillStyle = INK.pageGlow;
  ctx.fillRect(-5, -7, 10, 14);
  ctx.strokeStyle = '#9a7d3a';
  ctx.lineWidth = 1;
  ctx.strokeRect(-5, -7, 10, 14);
  ctx.fillStyle = '#7a5f22';
  ctx.fillRect(-3, -4, 6, 1.4);
  ctx.fillRect(-3, -1, 6, 1.4);
  ctx.fillRect(-3, 2, 4, 1.4);
  ctx.restore();
}

function drawLanternStand(ctx, l, t) {
  const { px, py } = worldToPx(l.x, l.y);
  const flick = 0.85 + 0.15 * Math.sin(t * 9 + l.phase * 5) * Math.sin(t * 5.3 + l.phase);
  ctx.fillStyle = '#241a10';
  ctx.fillRect(px - 2, py - 2, 4, 12);
  ctx.fillStyle = INK.amberDeep;
  ctx.fillRect(px - 4, py - 8, 8, 7);
  ctx.fillStyle = INK.amberHot;
  ctx.globalAlpha = flick;
  ctx.fillRect(px - 2, py - 6, 4, 4);
  ctx.globalAlpha = 1;
}

/** March rays across the fan; the cone stops at shelves and curtains. */
export function computeCone(game, g) {
  const rays = CONE_RAYS;
  const pts = [{ x: g.x, y: g.y }];
  for (let i = 0; i <= rays; i += 1) {
    const a = g.dir - g.fov / 2 + (g.fov * i) / rays;
    let d = 0;
    const step = 0.16;
    while (d < g.range) {
      d += step;
      const x = g.x + Math.cos(a) * d;
      const y = g.y + Math.sin(a) * d;
      const c = game.tileAt(Math.floor(x), Math.floor(y));
      if (c === '#' || c === 'C') { d -= step * 0.5; break; }
    }
    pts.push({ x: g.x + Math.cos(a) * Math.min(d, g.range), y: g.y + Math.sin(a) * Math.min(d, g.range) });
  }
  return pts;
}

function drawCone(ctx, game, g, t) {
  const pts = computeCone(game, g);
  const flick = 0.9 + 0.1 * Math.sin(t * 7 + g.phase * 3);
  const alert = g.suspicion > 0.45;
  const grad = ctx.createRadialGradient(
    FIELD_X + g.x * TILE, FIELD_Y + g.y * TILE, 4,
    FIELD_X + g.x * TILE, FIELD_Y + g.y * TILE, g.range * TILE,
  );
  grad.addColorStop(0, alert ? `rgba(255,90,60,${0.34 * flick})` : `rgba(255,184,77,${0.30 * flick})`);
  grad.addColorStop(1, alert ? 'rgba(255,90,60,0.02)' : 'rgba(255,184,77,0.02)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const { px, py } = worldToPx(p.x, p.y);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.fill();
  if (g.kind === 'hound') {
    // The scent ring: no cone of light, but a circle of dread.
    const { px, py } = worldToPx(g.x, g.y);
    ctx.strokeStyle = `rgba(214,120,90,${0.35 + 0.2 * Math.sin(t * 4)})`;
    ctx.setLineDash([5, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, g.scent * TILE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawDarkness(ctx, game, t) {
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = VIEW_W;
    lightCanvas.height = VIEW_H;
  }
  const lc = lightCanvas.getContext('2d');
  lc.clearRect(0, 0, VIEW_W, VIEW_H);
  lc.globalCompositeOperation = 'source-over';
  lc.fillStyle = 'rgba(4,6,17,0.88)';
  lc.fillRect(FIELD_X, FIELD_Y, COLS * TILE, ROWS * TILE);
  lc.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, strength) => {
    const { px, py } = worldToPx(x, y);
    const grad = lc.createRadialGradient(px, py, 1, px, py, r);
    grad.addColorStop(0, `rgba(0,0,0,${strength})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = grad;
    lc.fillRect(px - r, py - r, r * 2, r * 2);
  };
  for (const l of game.lanterns) {
    const flick = 0.94 + 0.06 * Math.sin(t * 8 + l.phase * 4);
    hole(l.x, l.y, l.r * TILE * flick, 0.97);
  }
  hole(game.player.x, game.player.y, 74, 0.5);
  if (game.exit) hole(game.exit.x, game.exit.y, 44, 0.35);
  for (const pg of game.pages) if (!pg.taken) hole(pg.x, pg.y, 26, 0.3);
  ctx.drawImage(lightCanvas, 0, 0);
  // Warm tint at the heart of each pool.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of game.lanterns) {
    const { px, py } = worldToPx(l.x, l.y);
    const grad = ctx.createRadialGradient(px, py, 2, px, py, l.r * TILE * 0.55);
    grad.addColorStop(0, 'rgba(255,170,70,0.13)');
    grad.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - l.r * TILE, py - l.r * TILE, l.r * TILE * 2, l.r * TILE * 2);
  }
  ctx.restore();
}

// ------------------------------------------------------------------ figures

function drawPlayer(ctx, game, t) {
  const p = game.player;
  const { px, py } = worldToPx(p.x, p.y);
  const bob = p.moving ? Math.sin(p.stepPhase) * 1.6 : Math.sin(t * 2) * 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(px, py + 10, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cloak: a deep-blue teardrop turned toward travel.
  ctx.save();
  ctx.translate(px, py + bob * 0.4);
  ctx.rotate(p.dir + Math.PI / 2);
  ctx.fillStyle = p.sneak ? INK.noviceDeep : '#4d7fa8';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.quadraticCurveTo(9, 2, 6, 11);
  ctx.quadraticCurveTo(0, 14, -6, 11);
  ctx.quadraticCurveTo(-9, 2, 0, -11);
  ctx.fill();
  ctx.restore();
  // Hood and face shadow.
  ctx.fillStyle = INK.novice;
  ctx.beginPath();
  ctx.arc(px, py - 3 + bob * 0.4, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#16222e';
  ctx.beginPath();
  ctx.arc(px + Math.cos(p.dir) * 2, py - 3 + Math.sin(p.dir) * 2 + bob * 0.4, 3.6, 0, Math.PI * 2);
  ctx.fill();
  if (p.sneak) {
    ctx.font = `bold 8px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(180,215,245,0.85)';
    ctx.fillText('SNEAK', px, py - 16);
  }
}

const WARDEN_STYLE = {
  patrol: { cloak: '#8a6a2e', trim: '#ffb84d', label: 'WARDEN' },
  sentry: { cloak: '#7a2430', trim: '#ff7a5c', label: 'SENTRY' },
  hound: { cloak: '#5a4632', trim: '#d6785a', label: 'HOUND' },
};

function drawGuard(ctx, game, g, t) {
  const { px, py } = worldToPx(g.x, g.y);
  const style = WARDEN_STYLE[g.kind];
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(px, py + 10, g.kind === 'hound' ? 12 : 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  if (g.kind === 'hound') {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(g.dir);
    ctx.fillStyle = style.cloak;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2c1e';
    ctx.beginPath();
    ctx.moveTo(7, -4); ctx.lineTo(10, -9); ctx.lineTo(12, -4); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, -4); ctx.lineTo(15, -8); ctx.lineTo(16, -3); ctx.closePath(); ctx.fill();
    // Sniff motes drift from the nose when the scent grows.
    if (g.suspicion > 0.25) {
      ctx.fillStyle = 'rgba(214,120,90,0.8)';
      const w = Math.sin(t * 6 + g.phase) * 2;
      ctx.fillRect(16, -1 + w * 0.3, 3, 1.6);
      ctx.fillRect(20, 1 - w * 0.3, 2, 1.4);
    }
    ctx.restore();
  } else {
    const sway = Math.sin(t * 3 + g.phase) * 0.8;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = style.cloak;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.quadraticCurveTo(10, 0 + sway, 7, 12);
    ctx.quadraticCurveTo(0, 15, -7, 12);
    ctx.quadraticCurveTo(-10, 0 - sway, 0, -13);
    ctx.fill();
    ctx.fillStyle = style.trim;
    ctx.fillRect(-7, 9, 14, 2.4);
    ctx.restore();
    // Head with a lantern cap, turned to facing.
    ctx.fillStyle = '#c9a877';
    ctx.beginPath();
    ctx.arc(px + Math.cos(g.dir) * 1.5, py - 6 + Math.sin(g.dir) * 1.5, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = style.cloak;
    ctx.beginPath();
    ctx.arc(px + Math.cos(g.dir) * 1.5, py - 8 + Math.sin(g.dir) * 1.5, 5.6, Math.PI, Math.PI * 2);
    ctx.fill();
    // Carried lantern, swung ahead of the warden.
    const lx = px + Math.cos(g.dir) * 13;
    const ly = py + Math.sin(g.dir) * 13 + Math.sin(t * 4 + g.phase) * 1.2;
    ctx.strokeStyle = '#6b5322';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(px, py - 2); ctx.lineTo(lx, ly); ctx.stroke();
    ctx.fillStyle = INK.amberHot;
    ctx.beginPath(); ctx.arc(lx, ly, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  // Suspicion: a small eye that fills, then a shout mark.
  if (g.suspicion > 0.04) {
    const w = 22;
    ctx.fillStyle = 'rgba(6,8,20,0.75)';
    ctx.fillRect(px - w / 2, py - 26, w, 5);
    ctx.fillStyle = g.suspicion > 0.75 ? INK.blood : INK.amber;
    ctx.fillRect(px - w / 2 + 1, py - 25, (w - 2) * g.suspicion, 3);
    if (g.sees) {
      ctx.font = `bold 15px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = INK.blood;
      ctx.fillText('!', px, py - 30);
    } else if (g.suspicion > 0.4) {
      ctx.font = `bold 12px ${SERIF}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = INK.amber;
      ctx.fillText('?', px, py - 29);
    }
  }
}

// ------------------------------------------------------------------ HUD

function panelBox(ctx, x, y, w, h, title) {
  ctx.fillStyle = INK.panelBg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  if (title) {
    ctx.font = `bold 11px ${SERIF}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = INK.amber;
    ctx.fillText(title, x + 12, y + 19);
    ctx.strokeStyle = 'rgba(255,184,77,0.35)';
    ctx.beginPath(); ctx.moveTo(x + 10, y + 26); ctx.lineTo(x + w - 10, y + 26); ctx.stroke();
  }
}

export function drawEye(ctx, game, cx, cy, t) {
  const alarm = game.alarmLevel;
  const open = 3 + alarm * 9 + Math.sin(t * 1.4) * 0.5;
  ctx.save();
  ctx.translate(cx, cy);
  // Sclera: an almond that opens with the alarm.
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.quadraticCurveTo(0, -open * 1.7, 30, 0);
  ctx.quadraticCurveTo(0, open * 1.7, -30, 0);
  ctx.closePath();
  ctx.fillStyle = INK.eyeWhite;
  ctx.fill();
  ctx.strokeStyle = alarm > 0.7 ? INK.blood : INK.amberDeep;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();
  // The pupil tracks the novice.
  const p = game.player;
  const dx = Math.max(-1, Math.min(1, (p.x - COLS / 2) / (COLS / 2)));
  const dy = Math.max(-1, Math.min(1, (p.y - ROWS / 2) / (ROWS / 2)));
  const iris = 6.5 + alarm * 2;
  ctx.fillStyle = alarm > 0.7 ? '#a02318' : alarm > 0.35 ? '#b06a1e' : '#4a5a7a';
  ctx.beginPath();
  ctx.arc(dx * 13, dy * open * 0.8, iris, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0c16';
  ctx.beginPath();
  ctx.arc(dx * 13, dy * open * 0.8, iris * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.font = `bold 9px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = alarm > 0.7 ? INK.blood : INK.parchmentDim;
  ctx.fillText(alarm > 0.85 ? 'SEEN!' : alarm > 0.45 ? 'THE EYE STIRS' : 'UNSEEN', cx, cy + 26);
}

function drawTopBar(ctx, game, t) {
  ctx.fillStyle = '#0d0b1e';
  ctx.fillRect(0, 0, VIEW_W, FIELD_Y);
  ctx.strokeStyle = INK.panelEdge;
  ctx.beginPath(); ctx.moveTo(0, FIELD_Y - 1); ctx.lineTo(VIEW_W, FIELD_Y - 1); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.font = `bold 19px ${SERIF}`;
  ctx.fillStyle = INK.parchment;
  const title = game.endless ? `ENDLESS WATCH — NIGHT ${game.endlessLevel}` : game.levelDef.name;
  ctx.fillText(title, 16, 30);
  ctx.font = `12px ${SERIF}`;
  ctx.fillStyle = INK.parchmentDim;
  ctx.fillText(game.endless ? 'Survive the escalating watch. One catch ends the night.' : game.levelDef.sub, 16, 50);
  drawEye(ctx, game, 700, 26, t);
  // Score block, right of the eye.
  ctx.textAlign = 'right';
  ctx.font = `bold 17px ${SERIF}`;
  ctx.fillStyle = INK.amber;
  const score = game.endless ? game.endlessScore : game.campaignScore;
  ctx.fillText(`SCORE ${score}`, 1010, 28);
  ctx.font = `12px ${SERIF}`;
  ctx.fillStyle = INK.parchmentDim;
  const secs = Math.floor(game.time);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  ctx.fillText(`time ${clock} · par ${game.levelDef.par}s · best ${Math.max(game.best, score)}`, 1010, 49);
  ctx.textAlign = 'left';
  ctx.font = `bold 13px ${SERIF}`;
  ctx.fillStyle = INK.parchmentDim;
  ctx.fillText(`${DIFFICULTIES[game.difficultyKey].name}${isMuted() ? ' · MUTED' : ''}`, 1090, 28);
  ctx.font = `11px ${SERIF}`;
  ctx.fillText('M mute · P pause · R retry', 1090, 49);
}

function drawPanel(ctx, game, t) {
  const x = PANEL_X;
  ctx.fillStyle = '#0d0b1e';
  ctx.fillRect(x, FIELD_Y, PANEL_W, ROWS * TILE);
  // Objective
  panelBox(ctx, x + 10, FIELD_Y + 10, PANEL_W - 20, 118, 'OBJECTIVE');
  ctx.font = `13px ${SERIF}`;
  ctx.fillStyle = INK.parchment;
  ctx.fillText(`Recover the lost pages`, x + 22, FIELD_Y + 52);
  for (let i = 0; i < game.pages.length; i += 1) {
    const got = game.pages[i].taken;
    const ix = x + 24 + i * 26;
    const iy = FIELD_Y + 66;
    ctx.fillStyle = got ? INK.pageGlow : '#2c2c44';
    ctx.fillRect(ix, iy, 15, 20);
    ctx.strokeStyle = got ? '#9a7d3a' : '#4a4a66';
    ctx.strokeRect(ix, iy, 15, 20);
    if (got) {
      ctx.fillStyle = '#7a5f22';
      ctx.fillRect(ix + 3, iy + 5, 9, 1.6);
      ctx.fillRect(ix + 3, iy + 9, 9, 1.6);
    }
  }
  ctx.font = `12px ${SERIF}`;
  ctx.fillStyle = game.pagesGot >= game.pages.length ? INK.exitGlow : INK.parchmentDim;
  ctx.fillText(
    game.pagesGot >= game.pages.length ? 'Exit stair open — slip out!' : `${game.pages.length - game.pagesGot} page(s) still in the dark`,
    x + 22, FIELD_Y + 106,
  );
  ctx.fillStyle = INK.parchmentDim;
  ctx.fillText(`Pages ${game.pagesGot}/${game.pages.length} · attempts ${game.attempts}`, x + 22, FIELD_Y + 122 - 4);
  // Tools
  panelBox(ctx, x + 10, FIELD_Y + 138, PANEL_W - 20, 84, 'TOOLS');
  ctx.font = `13px ${SERIF}`;
  ctx.fillStyle = INK.parchment;
  ctx.fillText('Pebble lure', x + 22, FIELD_Y + 178);
  for (let i = 0; i < Math.max(game.pebblesLeft, 0); i += 1) {
    ctx.fillStyle = '#cfc4a5';
    ctx.beginPath();
    ctx.arc(x + 130 + i * 20, FIELD_Y + 173, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `11.5px ${SERIF}`;
  ctx.fillStyle = INK.parchmentDim;
  ctx.fillText('CLICK a floor tile to toss one.', x + 22, FIELD_Y + 198);
  ctx.fillText('Wardens investigate the sound.', x + 22, FIELD_Y + 213);
  // Warden intel
  panelBox(ctx, x + 10, FIELD_Y + 232, PANEL_W - 20, 148, 'WARDEN INTEL');
  const counts = { patrol: 0, sentry: 0, hound: 0 };
  for (const g of game.guards) counts[g.kind] += 1;
  const rows = [
    ['patrol', 'WARDEN', 'walks a route, pauses, looks'],
    ['sentry', 'SENTRY', 'stands fast, gaze sweeping'],
    ['hound', 'HOUND', 'no cone — scents you in shadow'],
  ];
  rows.forEach(([kind, label, desc], i) => {
    const ry = FIELD_Y + 272 + i * 38;
    ctx.fillStyle = WARDEN_STYLE[kind].cloak;
    ctx.beginPath();
    ctx.arc(x + 32, ry - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = WARDEN_STYLE[kind].trim;
    ctx.fillRect(x + 24, ry + 2, 16, 2.4);
    ctx.font = `bold 12px ${SERIF}`;
    ctx.fillStyle = INK.parchment;
    ctx.fillText(`${label} ×${counts[kind]}`, x + 50, ry);
    ctx.font = `10.5px ${SERIF}`;
    ctx.fillStyle = INK.parchmentDim;
    ctx.fillText(desc, x + 50, ry + 13);
  });
  // Light & shadow legend + controls
  panelBox(ctx, x + 10, FIELD_Y + 390, PANEL_W - 20, 236, 'LIGHT & SHADOW');
  ctx.font = `11.5px ${SERIF}`;
  ctx.fillStyle = INK.parchment;
  const lines = [
    'Lantern light fills the eye FAST.',
    'Deep shadow nearly freezes it.',
    'SHIFT sneak: slow, silent, and a',
    'desk or curtain breaks sight.',
    'Curtains & tall grass hide you.',
    '',
    'WASD / arrows — move',
    'SHIFT — sneak (silent, hidden',
    '        in grass, low behind desks)',
    'CLICK — toss a pebble lure',
    'P — pause    R — retry chamber',
    'M — mute     ENTER — confirm',
    '',
    game.maxSuspicion <= 0.2 ? 'So far: a GHOST run (+500).' : game.maxSuspicion <= 0.65 ? 'So far: a SHADOW run (+200).' : 'So far: an OWL run — seen, but free.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, x + 22, FIELD_Y + 424 + i * 15.5));
}

function drawBanner(ctx, game) {
  if (!game.banner) return;
  const b = game.banner;
  const fade = Math.min(1, Math.min(b.t / 0.25, (b.dur - b.t) / 0.4));
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.textAlign = 'center';
  ctx.font = `bold 30px ${SERIF}`;
  ctx.fillStyle = 'rgba(6,8,20,0.72)';
  let w = ctx.measureText(b.text).width + 56;
  if (b.sub) {
    ctx.font = `italic 13.5px ${SERIF}`;
    w = Math.max(w, ctx.measureText(b.sub).width + 56);
    ctx.font = `bold 30px ${SERIF}`;
  }
  ctx.fillRect(512 - w / 2, 92, w, b.sub ? 74 : 52);
  ctx.strokeStyle = INK.amberDeep;
  ctx.strokeRect(512 - w / 2, 92, w, b.sub ? 74 : 52);
  ctx.fillStyle = INK.amberHot;
  ctx.fillText(b.text, 512, 128);
  if (b.sub) {
    ctx.font = `italic 13.5px ${SERIF}`;
    ctx.fillStyle = INK.parchment;
    ctx.fillText(b.sub, 512, 152);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

function drawWorld(ctx, game, t) {
  const decor = decorFor(game);
  drawFloor(ctx, game, decor);
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const c = game.tileAt(x, y);
      if (c === '#') drawShelf(ctx, game, decor, x, y);
      else if (c === '=') drawDesk(ctx, x, y);
      else if (c === 'C') drawCurtain(ctx, x, y, t);
      else if (c === 'g') drawGrass(ctx, x, y, t);
    }
  }
  drawExit(ctx, game, t);
  for (const pg of game.pages) drawPage(ctx, pg, t);
  for (const l of game.lanterns) drawLanternStand(ctx, l, t);
  // Pebble in flight / landed ring.
  if (game.pebbleFx) {
    const f = game.pebbleFx;
    const k = f.t / f.dur;
    const x = f.x0 + (f.x1 - f.x0) * k;
    const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 0.8;
    const { px, py } = worldToPx(x, y);
    ctx.fillStyle = '#e8dfc2';
    ctx.beginPath(); ctx.arc(px, py, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  if (game.ringFx) {
    const { px, py } = worldToPx(game.ringFx.x, game.ringFx.y);
    const r = 6 + game.ringFx.t * 5.2 * TILE * 0.55;
    ctx.strokeStyle = `rgba(232,223,194,${0.75 * (1 - game.ringFx.t / 0.7)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, r * 0.55, 0, Math.PI * 2); ctx.stroke();
  }
  drawDarkness(ctx, game, t);
  for (const g of game.guards) drawCone(ctx, game, g, t);
  for (const g of game.guards) drawGuard(ctx, game, g, t);
  drawPlayer(ctx, game, t);
  // Sparkles and score popups float above the dark.
  for (const p of game.particles) {
    const { px, py } = worldToPx(p.x, p.y);
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const p of game.popups) {
    const { px, py } = worldToPx(p.x, p.y);
    ctx.globalAlpha = Math.max(0, 1 - p.t / 1.4);
    ctx.font = `bold 15px ${SERIF}`;
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, px, py);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ------------------------------------------------------------------ screens

function parchmentPanel(ctx, w, h) {
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  ctx.fillStyle = 'rgba(232,217,174,0.97)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8a6f35';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  ctx.strokeStyle = 'rgba(138,111,53,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
  return { x, y };
}

function darkVeil(ctx, alpha) {
  ctx.fillStyle = `rgba(3,4,12,${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function drawTitle(ctx, game, t) {
  drawWorld(ctx, game, t);
  darkVeil(ctx, 0.55);
  const { x, y } = parchmentPanel(ctx, 880, 560);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2a1f0e';
  ctx.font = `bold 57px ${SERIF}`;
  ctx.fillText('GLOAMING ARCHIVE', VIEW_W / 2, y + 84);
  ctx.font = `italic 17px ${SERIF}`;
  ctx.fillStyle = '#5a4517';
  ctx.fillText('Slip past the lantern wardens. Recover the banned book, page by page, unseen.', VIEW_W / 2, y + 116);
  ctx.font = `13.5px ${SERIF}`;
  ctx.fillStyle = '#3d2f14';
  ctx.fillText('GOAL — gather every lost page in the chamber, then reach the glowing exit stair.', VIEW_W / 2, y + 146);
  ctx.fillText('LOSE — let the great eye fill, or be touched: the wardens take you.', VIEW_W / 2, y + 166);
  // How to play, in key caps.
  ctx.textAlign = 'left';
  ctx.font = `bold 13px ${SERIF}`;
  ctx.fillStyle = '#2a1f0e';
  ctx.fillText('HOW TO PLAY', x + 48, y + 204);
  ctx.font = `13px ${SERIF}`;
  const how = [
    '[WASD]/[←↑↓→] move      [SHIFT] sneak — silent, hidden in grass, low behind desks',
    '[CLICK] toss a pebble — wardens leave their routes to investigate the sound',
    'Lantern light fills the eye fast · deep shadow nearly freezes it · curtains hide you whole',
    '[P] pause   [R] retry   [M] mute   Ratings: GHOST unseen · SHADOW glimpsed · OWL seen but free',
  ];
  how.forEach((line, i) => ctx.fillText(line, x + 48, y + 228 + i * 21));
  // Feature sheet: the chambers and their keepers.
  ctx.font = `bold 13px ${SERIF}`;
  ctx.fillText('THE ARCHIVE', x + 48, y + 330);
  ctx.font = `12.5px ${SERIF}`;
  const feats = [
    '6 chambers — the Novice’s Stacks, Reading Room, Hound’s Wing, Candle Vault, Long Gallery, Gloaming Deep',
    '3 warden kinds — patrol WARDENS with routes · SENTRY gazes sweeping · HOUNDS that scent you in shadow',
    'Light-and-shadow hiding · pebble lures · ghost ratings · par times · best scores kept between nights',
  ];
  feats.forEach((line, i) => ctx.fillText(line, x + 48, y + 352 + i * 19));
  // Difficulty select.
  ctx.font = `bold 13px ${SERIF}`;
  ctx.fillText('DIFFICULTY  (press 1 · 2 · 3)', x + 48, y + 424);
  const keys = Object.keys(DIFFICULTIES);
  keys.forEach((key, i) => {
    const bx = x + 48 + i * 196;
    const selected = game.difficultyKey === key;
    ctx.fillStyle = selected ? '#2a1f0e' : 'rgba(42,31,14,0.12)';
    ctx.fillRect(bx, y + 436, 178, 40);
    ctx.strokeStyle = '#2a1f0e';
    ctx.strokeRect(bx, y + 436, 178, 40);
    ctx.fillStyle = selected ? INK.amberHot : '#2a1f0e';
    ctx.font = `bold 16px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.fillText(DIFFICULTIES[key].name, bx + 89, y + 462);
    ctx.textAlign = 'left';
  });
  ctx.font = `bold 15px ${SERIF}`;
  ctx.fillStyle = '#2a1f0e';
  ctx.textAlign = 'center';
  const blink = 0.6 + 0.4 * Math.sin(t * 3.4);
  ctx.globalAlpha = blink;
  ctx.fillText('ENTER — begin the campaign        E — Endless Watch (escalating chambers, one life)', VIEW_W / 2, y + 516);
  ctx.globalAlpha = 1;
  ctx.font = `12.5px ${SERIF}`;
  ctx.fillStyle = '#5a4517';
  ctx.fillText(`Best campaign ${game.best} · Best endless ${game.bestEndless}`, VIEW_W / 2, y + 540);
  ctx.textAlign = 'left';
}

export function drawIntro(ctx, game, t) {
  drawWorld(ctx, game, t);
  darkVeil(ctx, 0.5);
  const { x, y } = parchmentPanel(ctx, 700, 380);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2a1f0e';
  ctx.font = `bold 31px ${SERIF}`;
  ctx.fillText(game.endless ? `ENDLESS WATCH — NIGHT ${game.endlessLevel}` : game.levelDef.name, VIEW_W / 2, y + 72);
  ctx.font = `italic 15.5px ${SERIF}`;
  ctx.fillStyle = '#5a4517';
  ctx.fillText(game.levelDef.sub, VIEW_W / 2, y + 104);
  ctx.font = `15px ${SERIF}`;
  ctx.fillStyle = '#3d2f14';
  const counts = { patrol: 0, sentry: 0, hound: 0 };
  for (const g of game.guards) counts[g.kind] += 1;
  const lines = [
    `Pages to recover: ${game.pages.length}      Par time: ${game.levelDef.par}s      Pebbles: ${game.pebblesLeft}`,
    `Wardens on watch: ${counts.patrol} patrol · ${counts.sentry} sentry · ${counts.hound} hound`,
    `Lantern pools: ${game.lanterns.length} — light is danger, shadow is mercy`,
    '',
    'Gather every page, then take the exit stair unseen.',
    'A GHOST run (never truly seen) pays +500.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y + 152 + i * 27));
  ctx.font = `bold 16px ${SERIF}`;
  ctx.fillStyle = '#2a1f0e';
  const blink = 0.6 + 0.4 * Math.sin(t * 3.4);
  ctx.globalAlpha = blink;
  ctx.fillText('ENTER — slip into the dark', VIEW_W / 2, y + 344);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawCaught(ctx, game, t) {
  drawWorld(ctx, game, t);
  ctx.fillStyle = `rgba(120,10,10,${0.25 + game.flash * 0.3})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const { y } = parchmentPanel(ctx, 640, 330);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6e1408';
  ctx.font = `bold 44px ${SERIF}`;
  const by = { patrol: 'THE WARDEN', sentry: 'THE SENTRY', hound: 'THE HOUND' }[game.caughtBy] || 'THE WARDEN';
  ctx.fillText(`TAKEN BY ${by}`, VIEW_W / 2, y + 84);
  ctx.font = `italic 15.5px ${SERIF}`;
  ctx.fillStyle = '#5a4517';
  ctx.fillText('The great eye opened. The archive keeps its pages tonight.', VIEW_W / 2, y + 120);
  ctx.font = `15px ${SERIF}`;
  ctx.fillStyle = '#3d2f14';
  ctx.fillText(`Pages held: ${game.pagesGot}/${game.pages.length} · time ${Math.floor(game.time)}s · attempts so far ${game.attempts}`, VIEW_W / 2, y + 162);
  ctx.fillText('Each capture costs 150 from this chamber’s score when you clear it.', VIEW_W / 2, y + 190);
  if (game.endless) ctx.fillText('In the Endless Watch, one capture ends the night.', VIEW_W / 2, y + 218);
  ctx.font = `bold 16px ${SERIF}`;
  ctx.fillStyle = '#2a1f0e';
  ctx.fillText(game.endless ? 'ENTER — see the night’s tally' : 'R / ENTER — slip in again', VIEW_W / 2, y + 282);
  ctx.textAlign = 'left';
}

function scoreBreakdownLines(game) {
  const def = game.levelDef;
  const timeBonus = Math.max(0, Math.round((def.par - game.time) * 6));
  return [
    [`Pages recovered (${game.pagesGot} × 150)`, game.pagesGot * 150],
    [`Under par bonus (${def.par}s par)`, timeBonus],
    [`Stealth — ${game.rating}`, game.rating === 'GHOST' ? 500 : game.rating === 'SHADOW' ? 200 : 0],
    [`Pebbles unspent (${game.pebblesLeft} × 40)`, game.pebblesLeft * 40],
    [`Captures (−150 each)`, -game.attempts * 150],
  ];
}

function drawClear(ctx, game, t) {
  drawWorld(ctx, game, t);
  darkVeil(ctx, 0.45);
  const { y } = parchmentPanel(ctx, 660, 430);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2a1f0e';
  ctx.font = `bold 36px ${SERIF}`;
  ctx.fillText(game.endless ? `NIGHT ${game.endlessLevel} SURVIVED` : 'CHAMBER CLEARED', VIEW_W / 2, y + 66);
  ctx.font = `bold 30px ${SERIF}`;
  ctx.fillStyle = game.rating === 'GHOST' ? '#1d6e46' : game.rating === 'SHADOW' ? '#7a5a10' : '#6e3a14';
  ctx.fillText(`— ${game.rating} —`, VIEW_W / 2, y + 108);
  ctx.font = `15px ${SERIF}`;
  ctx.fillStyle = '#3d2f14';
  scoreBreakdownLines(game).forEach(([label, value], i) => {
    ctx.textAlign = 'left';
    ctx.fillText(label, VIEW_W / 2 - 210, y + 152 + i * 26);
    ctx.textAlign = 'right';
    ctx.fillText(String(value), VIEW_W / 2 + 210, y + 152 + i * 26);
  });
  ctx.textAlign = 'center';
  ctx.font = `bold 19px ${SERIF}`;
  ctx.fillStyle = '#2a1f0e';
  const totalLine = game.endless
    ? `Chamber ${game.levelScore} · Endless total ${game.endlessScore}`
    : `Chamber ${game.levelScore} · Campaign total ${game.campaignScore}`;
  ctx.fillText(totalLine, VIEW_W / 2, y + 152 + 5 * 26 + 16);
  ctx.font = `bold 16px ${SERIF}`;
  const blink = 0.6 + 0.4 * Math.sin(t * 3.4);
  ctx.globalAlpha = blink;
  ctx.fillText(game.endless ? 'ENTER — descend into the next night' : 'ENTER — the next chamber', VIEW_W / 2, y + 392);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function drawResults(ctx, game, t) {
  drawWorld(ctx, game, t);
  darkVeil(ctx, 0.6);
  const { y } = parchmentPanel(ctx, 720, 500);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#2a1f0e';
  ctx.font = `bold 34px ${SERIF}`;
  ctx.fillText(game.endless ? 'THE WATCH ENDS' : 'THE BOOK IS WHOLE', VIEW_W / 2, y + 62);
  ctx.font = `italic 15px ${SERIF}`;
  ctx.fillStyle = '#5a4517';
  ctx.fillText(
    game.endless ? 'One capture, and the archive closes over the night’s work.' : 'Every page recovered. The banned book leaves the archive in your satchel.',
    VIEW_W / 2, y + 92,
  );
  ctx.font = `14.5px ${SERIF}`;
  ctx.fillStyle = '#3d2f14';
  if (game.endless) {
    ctx.fillText(`Nights survived: ${game.endlessLevel}`, VIEW_W / 2, y + 140);
    ctx.fillText(`Endless score: ${game.endlessScore}`, VIEW_W / 2, y + 172);
    ctx.fillText(`Best endless: ${Math.max(game.bestEndless, game.endlessScore)}`, VIEW_W / 2, y + 204);
  } else {
    game.levelResults.forEach((r, i) => {
      const ry = y + 128 + i * 30;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${r.name.replace(/^Chamber [IVX]+ — /, '')}`, VIEW_W / 2 - 250, ry);
      ctx.textAlign = 'center';
      ctx.fillText(r.rating, VIEW_W / 2 + 108, ry);
      ctx.textAlign = 'right';
      ctx.fillText(String(r.score), VIEW_W / 2 + 250, ry);
    });
    ctx.textAlign = 'center';
    ctx.font = `bold 21px ${SERIF}`;
    ctx.fillStyle = '#2a1f0e';
    ctx.fillText(`CAMPAIGN TOTAL  ${game.campaignScore}`, VIEW_W / 2, y + 128 + 6 * 30 + 18);
    ctx.font = `14.5px ${SERIF}`;
    ctx.fillStyle = '#5a4517';
    ctx.fillText(game.newBest ? 'A new best night for the archive.' : `Best campaign: ${game.best}`, VIEW_W / 2, y + 128 + 6 * 30 + 48);
  }
  ctx.font = `bold 16px ${SERIF}`;
  ctx.fillStyle = '#2a1f0e';
  const blink = 0.6 + 0.4 * Math.sin(t * 3.4);
  ctx.globalAlpha = blink;
  ctx.fillText('ENTER — return to the title', VIEW_W / 2, y + 462);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ------------------------------------------------------------------ main

export function render(ctx, game, t) {
  ctx.fillStyle = INK.deep;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (game.screen === SCREEN.TITLE) {
    drawTitle(ctx, game, t);
    return;
  }
  if (game.screen === SCREEN.INTRO) {
    drawIntro(ctx, game, t);
    return;
  }
  drawWorld(ctx, game, t);
  drawTopBar(ctx, game, t);
  drawPanel(ctx, game, t);
  drawBanner(ctx, game);
  if (game.screen === SCREEN.PAUSED) {
    darkVeil(ctx, 0.5);
    ctx.textAlign = 'center';
    ctx.font = `bold 44px ${SERIF}`;
    ctx.fillStyle = INK.parchment;
    ctx.fillText('PAUSED', 512, 380);
    ctx.font = `16px ${SERIF}`;
    ctx.fillText('P — resume · the wardens hold their breath', 512, 416);
    ctx.textAlign = 'left';
  } else if (game.screen === SCREEN.CAUGHT) {
    drawCaught(ctx, game, t);
  } else if (game.screen === SCREEN.CLEAR) {
    drawClear(ctx, game, t);
  } else if (game.screen === SCREEN.RESULTS) {
    drawResults(ctx, game, t);
  }
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(200,30,20,${game.flash * 0.25})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
