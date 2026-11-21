// GLOAMING ARCHIVE — the simulation. Pure state and rules, no drawing and no
// DOM: the renderer reads this state, main.js feeds it input, and the shot
// scenes step it directly. Deterministic for a fixed step count — a chamber
// always plays out the same way from the same inputs.

import { COLS, ROWS, DIFFICULTIES, PLAYER, WARDEN } from './config.js';
import { LEVELS } from './levels.js';
import { sfx } from './audio.js';

export const SCREEN = {
  TITLE: 'title',
  INTRO: 'intro',
  PLAY: 'play',
  PAUSED: 'paused',
  CAUGHT: 'caught',
  CLEAR: 'clear',
  RESULTS: 'results',
};

const TAU = Math.PI * 2;

export function angleWrap(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Small seeded RNG so endless chambers and decor are reproducible. */
export function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Game {
  constructor() {
    this.screen = SCREEN.TITLE;
    this.difficultyKey = 'lantern';
    this.levelIndex = 0;
    this.campaignScore = 0;
    this.levelResults = [];
    this.endless = false;
    this.endlessLevel = 0;
    this.endlessScore = 0;
    this.time = 0;
    this.best = 0;
    this.bestEndless = 0;
    try {
      this.best = Number(localStorage.getItem('gloaming-archive-best-v1')) || 0;
      this.bestEndless = Number(localStorage.getItem('gloaming-archive-endless-v1')) || 0;
    } catch { /* storage may be unavailable; scores simply do not persist */ }
    this.banner = null;
    this.popups = [];
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.loadLevel(0, 'lantern');
  }

  get diff() {
    return DIFFICULTIES[this.difficultyKey];
  }

  // ------------------------------------------------------------- level setup

  loadLevel(index, difficultyKey) {
    const def = LEVELS[index];
    this.levelDef = def;
    this.levelIndex = index;
    if (difficultyKey) this.difficultyKey = difficultyKey;
    this.grid = def.map;
    this.lanterns = def.lanterns.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5, r: def.lanternRadius, phase: (x * 7 + y * 13) % 6 }));
    this.lanternTiles = new Set(def.lanterns.map(([x, y]) => x + ',' + y));
    this.pages = [];
    this.exit = null;
    let start = { x: 1.5, y: 1.5 };
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const c = def.map[y][x];
        if (c === 'P') start = { x: x + 0.5, y: y + 0.5 };
        if (c === 'E') this.exit = { x: x + 0.5, y: y + 0.5 };
        if (c === 'p') this.pages.push({ x: x + 0.5, y: y + 0.5, taken: false, bob: (x * 3 + y * 5) % 6 });
      }
    }
    this.player = {
      x: start.x, y: start.y, dir: 0, sneak: false, moving: false,
      stepPhase: 0, stepTimer: 0,
    };
    this.guards = def.guards.map((g) => this.makeGuard(g));
    this.pebblesLeft = Math.max(1, def.pebbles + this.diff.pebbleBonus);
    this.pebbleFx = null;
    this.time = 0;
    this.attempts = 0;
    this.maxSuspicion = 0;
    this.stirred = false;
    this.pagesGot = 0;
    this.exitAnnounced = false;
    this.levelScore = 0;
    this.rating = '';
    this.caughtBy = '';
    this.newBest = false;
  }

  makeGuard(def) {
    const spec = WARDEN[def.kind];
    const home = def.route ? def.route[0] : def.at;
    return {
      kind: def.kind,
      x: home[0] + 0.5,
      y: home[1] + 0.5,
      homeX: home[0] + 0.5,
      homeY: home[1] + 0.5,
      dir: def.face ?? 0,
      baseDir: def.face ?? 0,
      sweep: def.sweep ?? 0,
      route: def.route ? def.route.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 })) : null,
      wp: 1,
      state: 'patrol',
      pauseT: 0,
      invX: 0, invY: 0, invT: 0,
      suspicion: 0,
      sees: false,
      range: spec.range,
      fov: spec.fov,
      speed: spec.speed * this.diff.guardSpeedMul,
      scent: spec.scent ?? 0,
      cone: [],
      phase: Math.random() * TAU,
    };
  }

  startCampaign(difficultyKey) {
    this.difficultyKey = difficultyKey;
    this.endless = false;
    this.campaignScore = 0;
    this.levelResults = [];
    this.loadLevel(0, difficultyKey);
    this.screen = SCREEN.INTRO;
  }

  startEndless() {
    this.endless = true;
    this.endlessLevel = 1;
    this.endlessScore = 0;
    this.loadEndless(this.endlessLevel);
    this.screen = SCREEN.INTRO;
  }

  /** Endless Watch reuses the chamber shells with escalating warden pressure. */
  loadEndless(n) {
    const def = LEVELS[(n - 1) % LEVELS.length];
    this.loadLevel((n - 1) % LEVELS.length, this.difficultyKey);
    // Extra wardens join the watch as the night deepens.
    const extras = [
      { kind: 'patrol', route: [[2, 18], [29, 18]] },
      { kind: 'sentry', at: [16, 12], face: Math.PI / 2, sweep: 2.1 },
      { kind: 'hound', route: [[3, 18], [10, 18]] },
      { kind: 'patrol', route: [[2, 6], [9, 6]] },
    ];
    const extraCount = Math.min(extras.length, Math.floor((n - 1) / 1));
    for (let i = 0; i < extraCount; i += 1) {
      const g = this.makeGuard(extras[i]);
      // Skip an extra whose home is walled in this shell.
      if (!this.solidAt(Math.floor(g.x), Math.floor(g.y))) this.guards.push(g);
    }
    this.levelDef = def;
  }

  // ------------------------------------------------------------- world query

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return this.grid[ty][tx];
  }

  solidAt(tx, ty) {
    const c = this.tileAt(tx, ty);
    return c === '#' || c === '=' || this.lanternTiles.has(tx + ',' + ty);
  }

  /** Does this tile block a warden's sight of the novice? */
  sightBlockAt(tx, ty, sneaking) {
    const c = this.tileAt(tx, ty);
    if (c === '#' || c === 'C') return true;
    if (c === '=' && sneaking) return true;
    if (c === 'g' && sneaking) return true;
    return false;
  }

  losClear(x0, y0, x1, y1, sneaking) {
    const d = dist(x0, y0, x1, y1);
    const steps = Math.max(1, Math.ceil(d / 0.18));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (this.sightBlockAt(Math.floor(x), Math.floor(y), sneaking)) return false;
    }
    return true;
  }

  /** 0 in deep shadow, 1 standing in a lantern's heart. */
  lightAt(x, y) {
    let light = 0;
    for (const l of this.lanterns) {
      const d = dist(x, y, l.x, l.y);
      if (d < l.r) light = Math.max(light, 1 - d / l.r);
    }
    return light;
  }

  playerHidden() {
    const c = this.tileAt(Math.floor(this.player.x), Math.floor(this.player.y));
    if (c === 'C') return true;
    if (c === 'g' && this.player.sneak) return true;
    return false;
  }

  // ------------------------------------------------------------- actions

  tossPebble(tx, ty) {
    if (this.screen !== SCREEN.PLAY || this.pebblesLeft <= 0 || this.pebbleFx) {
      if (this.pebblesLeft <= 0 && this.screen === SCREEN.PLAY) sfx.denied();
      return false;
    }
    const cx = Math.min(COLS - 0.5, Math.max(0.5, tx));
    const cy = Math.min(ROWS - 0.5, Math.max(0.5, ty));
    if (this.solidAt(Math.floor(cx), Math.floor(cy))) return false;
    this.pebblesLeft -= 1;
    this.pebbleFx = { x0: this.player.x, y0: this.player.y, x1: cx, y1: cy, t: 0, dur: 0.38 };
    sfx.pebbleThrow();
    return true;
  }

  landPebble(x, y) {
    sfx.pebbleLand();
    this.ringFx = { x, y, t: 0 };
    for (const g of this.guards) {
      if (dist(g.x, g.y, x, y) <= 5.2 && g.state !== 'chase') {
        g.state = 'investigate';
        g.invX = x;
        g.invY = y;
        g.invT = 0;
      }
    }
    this.burst(x, y, 6, '#cfc4a5');
  }

  setBanner(text, sub, dur = 2.2) {
    this.banner = { text, sub, t: 0, dur };
  }

  burst(x, y, n, color) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * TAU;
      const sp = 0.6 + Math.random() * 1.8;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.4,
        t: 0, life: 0.5 + Math.random() * 0.5, color, size: 1.5 + Math.random() * 2,
      });
    }
  }

  popup(x, y, text, color = '#ffe9a8') {
    this.popups.push({ x, y, text, color, t: 0 });
  }

  // ------------------------------------------------------------- update

  update(dt, input) {
    if (this.screen === SCREEN.PLAY) this.time += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 1.2 * dt;
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const p of this.popups) {
      p.t += dt;
      p.y -= 0.55 * dt;
    }
    this.popups = this.popups.filter((p) => p.t < 1.4);
    if (this.ringFx) {
      this.ringFx.t += dt;
      if (this.ringFx.t > 0.7) this.ringFx = null;
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    if (this.screen !== SCREEN.PLAY) return;

    this.updatePlayer(dt, input);
    if (this.pebbleFx) {
      this.pebbleFx.t += dt;
      if (this.pebbleFx.t >= this.pebbleFx.dur) {
        const { x1, y1 } = this.pebbleFx;
        this.pebbleFx = null;
        this.landPebble(x1, y1);
      }
    }
    for (const g of this.guards) this.updateGuard(dt, g);
    this.updateDetection(dt);
    this.checkPagesAndExit(dt);
  }

  updatePlayer(dt, input) {
    const p = this.player;
    p.sneak = !!input.sneak;
    const mx = input.mx ?? 0;
    const my = input.my ?? 0;
    const len = Math.hypot(mx, my);
    p.moving = len > 0.01;
    const wasHidden = this.playerHidden();
    if (p.moving) {
      const speed = p.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const vx = (mx / Math.max(1, len)) * speed * dt;
      const vy = (my / Math.max(1, len)) * speed * dt;
      this.moveCircle(p, vx, vy);
      p.dir = Math.atan2(my, mx);
      p.stepPhase += dt * (p.sneak ? 5 : 9);
      p.stepTimer -= dt;
      if (!p.sneak && p.stepTimer <= 0) {
        p.stepTimer = 0.34;
        sfx.step();
      }
    }
    // Slipping into cover whispers: a curtain's folds, tall grass closing.
    if (!wasHidden && this.playerHidden()) sfx.rustle();
  }

  /** Axis-separated circle vs solid tiles: sliding along shelves feels right. */
  moveCircle(body, vx, vy) {
    const r = PLAYER.radius;
    body.x += vx;
    for (const [tx, ty] of this.nearTiles(body.x, body.y)) {
      if (!this.solidAt(tx, ty)) continue;
      const nx = Math.max(tx, Math.min(tx + 1, body.x));
      const ny = Math.max(ty, Math.min(ty + 1, body.y));
      const d = dist(body.x, body.y, nx, ny);
      if (d < r && d > 0.0001) body.x += ((body.x - nx) / d) * (r - d);
      else if (d <= 0.0001) body.x = tx - r - 0.01;
    }
    body.y += vy;
    for (const [tx, ty] of this.nearTiles(body.x, body.y)) {
      if (!this.solidAt(tx, ty)) continue;
      const nx = Math.max(tx, Math.min(tx + 1, body.x));
      const ny = Math.max(ty, Math.min(ty + 1, body.y));
      const d = dist(body.x, body.y, nx, ny);
      if (d < r && d > 0.0001) body.y += ((body.y - ny) / d) * (r - d);
      else if (d <= 0.0001) body.y = ty - r - 0.01;
    }
    body.x = Math.min(COLS - r, Math.max(r, body.x));
    body.y = Math.min(ROWS - r, Math.max(r, body.y));
  }

  nearTiles(x, y) {
    const out = [];
    for (let ty = Math.floor(y - 1); ty <= Math.floor(y + 1); ty += 1) {
      for (let tx = Math.floor(x - 1); tx <= Math.floor(x + 1); tx += 1) out.push([tx, ty]);
    }
    return out;
  }

  updateGuard(dt, g) {
    const spec = WARDEN[g.kind];
    if (g.kind === 'sentry') {
      if (g.state === 'investigate') {
        g.dir = Math.atan2(g.invY - g.y, g.invX - g.x);
        g.invT += dt;
        if (g.invT > 2.2) g.state = 'patrol';
      } else {
        g.dir = g.baseDir + Math.sin(this.time * (TAU / (g.sweep * 2 || 4))) * 0.85;
      }
      return;
    }
    let target = null;
    let speed = g.speed;
    if (g.state === 'investigate') {
      target = { x: g.invX, y: g.invY };
      speed = g.speed * 1.25;
      if (dist(g.x, g.y, target.x, target.y) < 0.25) {
        g.invT += dt;
        g.dir += dt * 1.8;
        if (g.invT > 1.7) {
          g.state = 'return';
          g.invT = 0;
        }
        return;
      }
    } else if (g.state === 'return') {
      target = g.route[g.wp];
      if (dist(g.x, g.y, target.x, target.y) < 0.2) g.state = 'patrol';
    } else if (g.state === 'chase') {
      target = { x: this.player.x, y: this.player.y };
      speed = g.speed * 1.45;
    } else {
      // patrol: walk the route, pause at each waypoint and look around
      if (g.pauseT > 0) {
        g.pauseT -= dt;
        g.dir += Math.sin(this.time * 1.7 + g.phase) * dt * 0.7;
        return;
      }
      target = g.route[g.wp];
      if (dist(g.x, g.y, target.x, target.y) < 0.18) {
        g.wp = (g.wp + 1) % g.route.length;
        g.pauseT = spec.pause * (0.7 + ((g.phase * 7) % 0.6));
        return;
      }
    }
    if (target) {
      const want = Math.atan2(target.y - g.y, target.x - g.x);
      g.dir += Math.max(-3.2 * dt, Math.min(3.2 * dt, angleWrap(want - g.dir)));
      const stepLen = Math.min(speed * dt, dist(g.x, g.y, target.x, target.y));
      const nx = g.x + Math.cos(g.dir) * stepLen;
      const ny = g.y + Math.sin(g.dir) * stepLen;
      // Wardens slide along shelves like the novice; a blocked axis just stops.
      if (!this.solidAt(Math.floor(nx), Math.floor(g.y))) g.x = nx;
      if (!this.solidAt(Math.floor(g.x), Math.floor(ny))) g.y = ny;
    }
  }

  guardSees(g) {
    const p = this.player;
    const d = dist(g.x, g.y, p.x, p.y);
    if (d > g.range) return false;
    if (d > 1.15) {
      const diff = Math.abs(angleWrap(Math.atan2(p.y - g.y, p.x - g.x) - g.dir));
      if (diff > g.fov / 2) return false;
    }
    if (this.playerHidden() && d > 1.25) return false;
    return this.losClear(g.x, g.y, p.x, p.y, p.sneak);
  }

  updateDetection(dt) {
    const p = this.player;
    const light = this.lightAt(p.x, p.y);
    let worst = 0;
    for (const g of this.guards) {
      g.sees = this.guardSees(g);
      let rate = 0;
      if (g.sees) {
        const d = dist(g.x, g.y, p.x, p.y);
        const closeness = 1.15 - Math.min(1, d / g.range) * 0.55;
        rate = (0.34 + light * 1.25) * closeness;
        if (p.sneak) rate *= 0.5;
        if (p.moving && !p.sneak) rate *= 1.18;
        rate *= this.diff.detectMul;
      } else if (g.kind === 'hound') {
        // The hound's nose ignores shadow: lingering close fills its suspicion.
        const d = dist(g.x, g.y, p.x, p.y);
        if (d < g.scent) {
          rate = (1 - d / g.scent) * 0.85 * this.diff.detectMul;
          g.sees = d < g.scent * 0.55;
        }
      }
      if (rate > 0) {
        const before = g.suspicion;
        g.suspicion = Math.min(1, g.suspicion + rate * dt * this.diff.grace);
        if (before < 0.45 && g.suspicion >= 0.45) {
          if (!this.stirred) {
            this.stirred = true;
            this.setBanner('THE EYE STIRS', 'a warden has caught your scent of candle-smoke', 1.8);
            sfx.stir();
            if (g.kind === 'hound') sfx.hound();
          }
        }
        if (g.suspicion > 0.62 && g.kind === 'hound' && g.state !== 'investigate') g.state = 'chase';
      } else {
        g.suspicion = Math.max(0, g.suspicion - dt * 0.22);
        if (g.state === 'chase' && g.suspicion < 0.3) g.state = 'return';
      }
      worst = Math.max(worst, g.suspicion);
      // Touch is capture, whatever the meter says.
      if (dist(g.x, g.y, p.x, p.y) < 0.52) {
        this.caught(g);
        return;
      }
    }
    this.maxSuspicion = Math.max(this.maxSuspicion, worst);
    this.alarm = worst;
    if (worst >= 1) {
      const culprit = this.guards.find((g) => g.suspicion >= 1) ?? this.guards[0];
      this.caught(culprit);
    }
  }

  caught(g) {
    if (this.screen !== SCREEN.PLAY) return;
    this.screen = SCREEN.CAUGHT;
    this.caughtBy = g ? g.kind : 'patrol';
    this.attempts += 1;
    this.shake = 1;
    this.flash = 1;
    sfx.caught();
  }

  retryLevel() {
    const keepScore = this.campaignScore;
    const keepResults = this.levelResults;
    const keepAttempts = this.attempts;
    if (this.endless) this.loadEndless(this.endlessLevel);
    else this.loadLevel(this.levelIndex, this.difficultyKey);
    this.campaignScore = keepScore;
    this.levelResults = keepResults;
    this.attempts = keepAttempts;
    this.screen = SCREEN.PLAY;
  }

  checkPagesAndExit() {
    const p = this.player;
    for (const pg of this.pages) {
      if (!pg.taken && dist(p.x, p.y, pg.x, pg.y) < 0.62) {
        pg.taken = true;
        this.pagesGot += 1;
        sfx.page();
        this.burst(pg.x, pg.y, 14, '#ffe9a8');
        this.popup(pg.x, pg.y - 0.6, '+150', '#ffe9a8');
        if (this.pagesGot >= this.pages.length) {
          this.setBanner('ALL PAGES RECOVERED', 'the exit stair breathes green — go, unseen', 2.4);
          sfx.unlock();
        } else {
          this.setBanner(`PAGE ${this.pagesGot} OF ${this.pages.length}`, 'the banned book grows heavier', 1.5);
        }
      }
    }
    if (this.exit && dist(p.x, p.y, this.exit.x, this.exit.y) < 0.55) {
      if (this.pagesGot >= this.pages.length) this.completeLevel();
      else if (!this.exitAnnounced) {
        this.exitAnnounced = true;
        this.setBanner('THE STAIR IS SEALED', `${this.pages.length - this.pagesGot} page(s) still sleep in the dark`, 1.8);
        sfx.denied();
        setTimeout(() => { this.exitAnnounced = false; }, 2600);
      }
    }
  }

  completeLevel() {
    const def = this.levelDef;
    const timeBonus = Math.max(0, Math.round((def.par - this.time) * 6));
    const ghost = this.maxSuspicion <= 0.2;
    const shadow = !ghost && this.maxSuspicion <= 0.65;
    const stealthBonus = ghost ? 500 : shadow ? 200 : 0;
    const pebbleBonus = this.pebblesLeft * 40;
    const attemptPenalty = this.attempts * 150;
    this.levelScore = Math.max(100, this.pagesGot * 150 + timeBonus + stealthBonus + pebbleBonus - attemptPenalty);
    this.rating = ghost ? 'GHOST' : shadow ? 'SHADOW' : 'OWL';
    sfx.clear();
    if (ghost) this.popup(this.player.x, this.player.y - 1, 'GHOST! +500', '#8affc1');
    if (this.endless) {
      this.endlessScore += this.levelScore;
      this.screen = SCREEN.CLEAR;
      return;
    }
    this.campaignScore += this.levelScore;
    this.levelResults.push({
      name: def.name, score: this.levelScore, rating: this.rating,
      time: this.time, attempts: this.attempts,
    });
    if (this.levelIndex >= LEVELS.length - 1) {
      this.screen = SCREEN.RESULTS;
      if (this.campaignScore > this.best) {
        this.best = this.campaignScore;
        this.newBest = true;
        try { localStorage.setItem('gloaming-archive-best-v1', String(this.best)); } catch { /* ignore */ }
      }
    } else {
      this.screen = SCREEN.CLEAR;
    }
  }

  nextLevel() {
    if (this.endless) {
      this.endlessLevel += 1;
      this.loadEndless(this.endlessLevel);
      this.screen = SCREEN.INTRO;
      return;
    }
    this.loadLevel(this.levelIndex + 1, this.difficultyKey);
    this.screen = SCREEN.INTRO;
  }

  finishEndless() {
    if (this.endlessScore > this.bestEndless) {
      this.bestEndless = this.endlessScore;
      this.newBest = true;
      try { localStorage.setItem('gloaming-archive-endless-v1', String(this.bestEndless)); } catch { /* ignore */ }
    }
    this.screen = SCREEN.RESULTS;
  }

  /** The alarm level the eye should show: the worst warden's suspicion. */
  get alarmLevel() {
    return this.alarm ?? 0;
  }
}
