import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';

const root = dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.DATA_FILE || join(root, 'presentation-data.json');
const pin = process.env.PRESENTER_PIN || String(randomInt(100000, 1000000));
const port = Number(process.env.PORT) || 3000;
const lanAddress = Object.values(networkInterfaces()).flat().find(address => address.family === 'IPv4' && !address.internal)?.address;
const duration = 5 * 60 * 1000;
const choices = {
  place: ['room', 'washroom', 'salon', 'other', 'do-not-shave'],
  reaction: ['confident', 'awkward', 'both'],
  confidence: ['approval', 'self', 'both']
};

export function freshState() {
  return { schemaVersion: 2, votes: [], generation: 0, status: 'lobby', elapsedMs: 0, startedAt: null };
}

export function snapshot(state, now = Date.now()) {
  const elapsedMs = Math.min(duration, state.elapsedMs + (state.status === 'running' ? Math.max(0, now - state.startedAt) : 0));
  return { status: elapsedMs >= duration && state.status === 'running' ? 'ended' : state.status, elapsedMs, duration, generation: state.generation, votes: state.votes.map(({ id, ...answers }) => answers) };
}

export function validVote(body) {
  return body && typeof body.id === 'string' && /^[a-f0-9-]{36}$/.test(body.id)
    && Object.entries(choices).every(([key, values]) => values.includes(body[key]));
}

let state;
try {
  const saved = JSON.parse(await readFile(dataFile, 'utf8'));
  state = saved.schemaVersion === 2 ? { ...freshState(), ...saved } : { ...freshState(), generation: (saved.generation || 0) + 1 };
  if (state.status === 'running' && Date.now() - state.startedAt + state.elapsedMs >= duration) {
    state.status = 'ended';
    state.elapsedMs = duration;
    state.startedAt = null;
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  state = freshState();
}

const json = (response, code, body) => {
  response.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
};

async function bodyOf(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 4096) throw new Error('Request too large');
  }
  return JSON.parse(raw);
}

async function save() {
  await writeFile(dataFile, JSON.stringify(state));
}

export function control(state, action, now = Date.now()) {
  const current = snapshot(state, now);
  const elapsed = current.elapsedMs;
  if (action === 'start' || action === 'resume') {
    if (current.status !== 'lobby' && current.status !== 'paused') return false;
    state.status = 'running'; state.startedAt = now;
  } else if (action === 'pause') {
    if (current.status !== 'running') return false;
    state.status = 'paused'; state.elapsedMs = elapsed; state.startedAt = null;
  } else if (action === 'reset-timer') {
    state.status = 'lobby'; state.elapsedMs = 0; state.startedAt = null;
  } else if (action === 'clear-votes') {
    state.votes = [];
    state.generation += 1;
  } else return false;
  return true;
}

const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png' };
const publicUrl = request => process.env.PUBLIC_URL || (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(request.headers.host) && lanAddress ? `http://${lanAddress}:${port}` : `${request.headers['x-forwarded-proto'] || 'http'}://${request.headers.host}`);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (request.method === 'GET' && url.pathname === '/api/state') return json(response, 200, snapshot(state));
      if (request.method === 'GET' && url.pathname === '/api/config') return json(response, 200, { audienceUrl: publicUrl(request) });
      if (request.method === 'GET' && url.pathname === '/api/qr') {
        const svg = await QRCode.toString(publicUrl(request), { type: 'svg', margin: 1, color: { dark: '#071a40', light: '#ffffff' } });
        response.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' });
        return response.end(svg);
      }
      if (request.method === 'POST' && url.pathname === '/api/vote') {
        const body = await bodyOf(request);
        if (!validVote(body)) return json(response, 400, { error: 'Please answer all three questions.' });
        const index = state.votes.findIndex(vote => vote.id === body.id);
        if (index < 0) state.votes.push(body); else state.votes[index] = body;
        await save();
        return json(response, 200, { ok: true });
      }
      if (request.method === 'POST' && url.pathname === '/api/control') {
        const body = await bodyOf(request);
        if (body.pin !== pin) return json(response, 403, { error: 'Incorrect presenter PIN.' });
        if (!control(state, body.action)) return json(response, 400, { error: 'Action unavailable right now.' });
        await save();
        return json(response, 200, snapshot(state));
      }
      if (request.method !== 'GET') return json(response, 405, { error: 'Method not allowed.' });
      const files = { '/': 'index.html', '/presenter': 'presenter.html', '/app.js': 'app.js', '/styles.css': 'styles.css', '/assets/gillette_doodle_background.png': 'assets/gillette_doodle_background.png', '/assets/gillette_wordmark_on_black_bg.png': 'assets/gillette_wordmark_on_black_bg.png' };
      const file = files[url.pathname];
      if (!file) return json(response, 404, { error: 'Not found.' });
      response.writeHead(200, { 'content-type': `${mime[extname(file)]}; charset=utf-8` });
      response.end(await readFile(join(root, file)));
    } catch (error) {
      json(response, error instanceof SyntaxError || error.message === 'Request too large' ? 400 : 500, { error: error.message === 'Request too large' ? error.message : 'Something went wrong.' });
    }
  }).listen(port, '0.0.0.0', () => {
    console.log(`Audience: http://localhost:${port}/`);
    if (lanAddress) console.log(`Phones on the same Wi-Fi: http://${lanAddress}:${port}/`);
    console.log(`Presenter: http://localhost:${port}/presenter`);
    console.log(`Presenter PIN: ${pin}`);
  });
}
