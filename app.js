const $ = selector => document.querySelector(selector);
const isPresenter = document.body.dataset.page === 'presenter';
const chapters = [
  { name: 'The room', cue: 'Reveal the live result. The 90% line belongs to your separate research, not this live sample.' },
  { name: 'Private meets public', cue: 'A half-shaved face meets Khokha, one of the busiest places on campus.' },
  { name: 'The contrast', cue: 'Point out the onlookers and the model’s calm posture and headphones.' },
  { name: 'The ad', cue: 'Show your ad on the projector. Ask Zaynah what changes when the private act moves to Khokha.' },
  { name: 'For yourself', cue: 'Compare approval in older ads with self-assurance here. Close with the Gillette line.' }
];
let latest;
let lastScene = '';

const clock = ms => {
  const seconds = Math.ceil(Math.max(0, 300000 - ms) / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};
const tally = (votes, question, value) => votes.filter(vote => vote[question] === value).length;
const percent = (count, total) => total ? Math.round(count / total * 100) : 0;

function results(state) {
  const total = state.votes.length;
  const shavers = state.votes.filter(vote => vote.place !== 'do-not-shave');
  const privateCount = tally(state.votes, 'place', 'room') + tally(state.votes, 'place', 'washroom');
  return `<div class="result-scene"><span class="micro">${total} ${total === 1 ? 'VOTE' : 'VOTES'} · LIVE</span><h2>WHERE WE<br><em>SHAVE.</em></h2><div class="result-number">${shavers.length ? percent(privateCount, shavers.length) : '—'}<small>${shavers.length ? '%' : ''}</small></div><p>${shavers.length ? `room or washroom · ${privateCount} of ${shavers.length} who shave` : 'Waiting for shaving responses'}</p><div class="result-blade" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
}

function sceneHtml(state, index) {
  const total = state.votes.length;
  if (state.status === 'lobby') return results(state);
  if (index === 0) return results(state);
  if (index === 1) return `<div class="statement-scene"><h2>PRIVATE<br><em>MEETS PUBLIC.</em></h2><p>Half shaved. Middle of Khokha.</p><div class="shave-swipe" aria-hidden="true"></div></div>`;
  if (index === 2) return `<div class="question-scene"><div class="question-mark">?</div><h2>THEY STARE.<br><em>HE DOESN'T.</em></h2><p>${percent(tally(state.votes, 'reaction', 'confident') + tally(state.votes, 'reaction', 'both'), total)}% saw confidence in the scene.</p></div>`;
  if (index === 3) return `<div class="ad-scene"><div class="ad-frame"><span class="frame-corner top-left"></span><span class="frame-corner bottom-right"></span><img src="/assets/gillette_wordmark_on_black_bg.png" alt="Gillette"></div><span class="side-note">LOOK UP.</span></div>`;
  return `<div class="final-scene"><span class="micro">${percent(tally(state.votes, 'confidence', 'self') + tally(state.votes, 'confidence', 'both'), total)}% CHOSE SELF-ASSURANCE</span><h2><span>NOT FOR THEM.</span><em>FOR YOURSELF.</em></h2><p>Unbothered. Unshaken. Unmistakably Gillette.</p></div>`;
}

function render(state) {
  latest = state;
  const index = Math.min(4, Math.floor(state.elapsedMs / 60000));
  if (isPresenter) {
    $('#presenter-clock').textContent = clock(state.elapsedMs);
    $('#status-text').textContent = state.status.toUpperCase();
    $('#vote-count').textContent = `${state.votes.length} ${state.votes.length === 1 ? 'RESPONSE' : 'RESPONSES'}`;
    $('#phase-name').textContent = state.status === 'lobby' ? 'Live survey results' : chapters[index].name;
    $('#phase-cue').textContent = state.status === 'lobby' ? 'Let everyone finish the three questions. The results update as votes arrive.' : chapters[index].cue;
    $('#start').disabled = !['lobby', 'paused'].includes(state.status);
    $('#start').innerHTML = state.status === 'paused' ? 'RESUME <span>↗</span>' : 'START 5:00 <span>↗</span>';
    $('#pause').disabled = state.status !== 'running';
    return;
  }
  const voted = localStorage.getItem('ss100-voted') === String(state.generation);
  $('#survey').hidden = voted;
  $('#experience').hidden = !voted;
  if (!voted) return;
  $('#audience-clock').textContent = clock(state.elapsedMs);
  $('#live-indicator').textContent = state.status === 'lobby' ? 'WAITING' : state.status === 'paused' ? 'PAUSED' : state.status === 'ended' ? 'FINISHED' : 'LIVE';
  const key = `${state.status === 'lobby' ? 'lobby' : index}-${JSON.stringify(state.votes)}`;
  if (key !== lastScene) {
    $('#scene').innerHTML = sceneHtml(state, index);
    $('#scene').classList.remove('arrive');
    void $('#scene').offsetWidth;
    $('#scene').classList.add('arrive');
    lastScene = key;
  }
  $('#scene-label').textContent = state.status === 'lobby' ? 'LIVE RESULTS' : `${String(index + 1).padStart(2, '0')} / 05`;
}

async function refresh() {
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not connect');
    render(await response.json());
  } catch {
    if (isPresenter) $('#control-error').textContent = 'Connection lost. Reconnecting…';
    else $('#live-indicator').textContent = 'RECONNECTING…';
  }
}

if (isPresenter) {
  fetch('/api/config').then(response => response.json()).then(({ audienceUrl }) => {
    $('#audience-url').href = audienceUrl;
    $('#audience-url').textContent = audienceUrl;
  });
  $('#pin').value = sessionStorage.getItem('ss100-pin') || '';
  async function send(action) {
    $('#control-error').textContent = '';
    const enteredPin = $('#pin').value.trim();
    if (!enteredPin) return $('#control-error').textContent = 'Enter the PIN from the server terminal.';
    if (action === 'clear-votes' && !confirm('Clear all audience answers? This cannot be undone.')) return;
    try {
      const response = await fetch('/api/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: enteredPin, action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      sessionStorage.setItem('ss100-pin', enteredPin);
      render(data);
    } catch (error) { $('#control-error').textContent = error.message; }
  }
  $('#start').addEventListener('click', () => send(latest?.status === 'paused' ? 'resume' : 'start'));
  $('#pause').addEventListener('click', () => send('pause'));
  $('#reset').addEventListener('click', () => send('reset-timer'));
  $('#clear').addEventListener('click', () => send('clear-votes'));
} else {
  const steps = [...document.querySelectorAll('#survey-form fieldset')];
  let step = 0;
  function showStep(next) {
    step = next;
    steps.forEach((field, index) => field.hidden = index !== step);
    $('#step-count').textContent = `0${step + 1} / 03`;
    $('#progress-fill').style.transform = `scaleX(${(step + 1) / steps.length})`;
    $('#back-step').hidden = step === 0;
    $('#submit-vote').hidden = true;
    steps[step].classList.remove('step-enter');
    void steps[step].offsetWidth;
    steps[step].classList.add('step-enter');
    steps[step].querySelector('legend').focus();
  }
  steps.forEach((field, index) => field.addEventListener('change', () => {
    if (index < steps.length - 1) setTimeout(() => { if (step === index) showStep(index + 1); }, 260);
    else setTimeout(() => { if (step === index) $('#survey-form').requestSubmit(); }, 260);
  }));
  $('#back-step').addEventListener('click', () => showStep(step - 1));
  showStep(0);
  $('#survey-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('#submit-vote');
    if (button.disabled) return;
    const answers = Object.fromEntries(new FormData(form));
    const id = localStorage.getItem('ss100-id') || crypto.randomUUID();
    button.disabled = true;
    $('#form-error').textContent = '';
    try {
      const response = await fetch('/api/vote', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, ...answers }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      localStorage.setItem('ss100-id', id);
      localStorage.setItem('ss100-voted', String(latest?.generation ?? 0));
      await refresh();
    } catch (error) { $('#form-error').textContent = error.message || 'Could not send your answers. Try again.'; button.hidden = false; }
    finally { button.disabled = false; }
  });
}

refresh();
setInterval(refresh, 1500);
