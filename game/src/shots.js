// GLOAMING ARCHIVE — the scripted screenshot scenes behind ?shot=<name>.
// Each scene loads a real chamber and stages its live state — positions,
// suspicion, pages, banners, particles — then main.js renders that state at a
// fixed instant. Nothing here draws; every pixel comes from the game's own
// renderer, exactly as in play.

import { SCREEN } from './engine.js';

function stagePlay(game) {
  // Chamber II, mid-action: one page banked, a pebble just tossed to pull the
  // patrol off its route, the sentry's cone on the novice and the eye half open.
  game.startCampaign('lantern');
  game.loadLevel(1, 'lantern');
  game.screen = SCREEN.PLAY;
  game.campaignScore = 1250;
  game.time = 34;
  game.pages[0].taken = true;
  game.pagesGot = 1;
  game.pebblesLeft = 2;
  const p = game.player;
  p.x = 14.4;
  p.y = 8.5;
  p.dir = Math.PI;
  p.sneak = true;
  const sentry = game.guards.find((g) => g.kind === 'sentry');
  sentry.dir = Math.PI;
  sentry.baseDir = Math.PI;
  sentry.suspicion = 0.55;
  sentry.sees = true;
  const patrol = game.guards.find((g) => g.kind === 'patrol');
  patrol.state = 'investigate';
  patrol.invX = 5.5;
  patrol.invY = 6.5;
  patrol.suspicion = 0.28;
  game.ringFx = { x: 5.5, y: 6.5, t: 0.18 };
  game.alarm = 0.55;
  game.maxSuspicion = 0.55;
  game.setBanner('PAGE 1 OF 4', 'a pebble sings against the reading-room floor', 99);
  game.banner.t = 0.6;
  game.popup(14.4, 7.6, '+150', '#ffe9a8');
  game.burst(14.4, 8.5, 8, '#ffe9a8');
}

function stageLate(game) {
  // Chamber VI, the Gloaming Deep: hound on the scent in the grass, a sentry
  // sweeping overhead, three pages banked and the eye stirring.
  game.startCampaign('lantern');
  game.loadLevel(5, 'lantern');
  game.screen = SCREEN.PLAY;
  game.campaignScore = 5120;
  game.time = 87;
  game.pages[0].taken = true;
  game.pages[1].taken = true;
  game.pages[3].taken = true;
  game.pagesGot = 3;
  game.pebblesLeft = 1;
  const p = game.player;
  p.x = 15.5;
  p.y = 16.5;
  p.dir = -Math.PI / 2;
  p.sneak = true;
  const hound = game.guards.find((g) => g.kind === 'hound');
  hound.x = 20.5;
  hound.y = 16.5;
  hound.dir = Math.PI;
  hound.suspicion = 0.62;
  hound.state = 'chase';
  const sentry = game.guards.find((g) => g.kind === 'sentry');
  sentry.dir = Math.PI / 2 + 0.4;
  sentry.suspicion = 0.3;
  game.alarm = 0.62;
  game.maxSuspicion = 0.62;
  game.setBanner('THE EYE STIRS', 'the hound has your scent — break away, into shadow', 99);
  game.banner.t = 0.6;
  game.popup(15.5, 15.4, '+150', '#ffe9a8');
}

function stageResults(game) {
  // The campaign tally, exactly as a finished run leaves it.
  game.startCampaign('lantern');
  game.loadLevel(5, 'lantern');
  game.levelResults = [
    { name: 'Chamber I — The Novice’s Stacks', score: 1285, rating: 'GHOST', time: 61, attempts: 0 },
    { name: 'Chamber II — The Reading Room', score: 1140, rating: 'SHADOW', time: 88, attempts: 0 },
    { name: 'Chamber III — The Hound’s Wing', score: 1330, rating: 'GHOST', time: 92, attempts: 0 },
    { name: 'Chamber IV — The Candle Vault', score: 1015, rating: 'OWL', time: 121, attempts: 1 },
    { name: 'Chamber V — The Long Gallery', score: 1205, rating: 'SHADOW', time: 118, attempts: 0 },
    { name: 'Chamber VI — The Gloaming Deep', score: 1470, rating: 'GHOST', time: 129, attempts: 0 },
  ];
  game.campaignScore = game.levelResults.reduce((sum, r) => sum + r.score, 0);
  game.best = game.campaignScore;
  game.newBest = true;
  game.screen = SCREEN.RESULTS;
}

export function stageShot(name, game) {
  if (name === 'play') stagePlay(game);
  else if (name === 'late') stageLate(game);
  else if (name === 'results') stageResults(game);
  else {
    game.loadLevel(0, 'lantern');
    game.screen = SCREEN.TITLE;
  }
  return game.screen;
}
