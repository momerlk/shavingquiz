const $ = selector => document.querySelector(selector);
const isPresenter = document.body.dataset.page === 'presenter';
const chapters = [
  { name: 'The room', cue: 'Reveal the 91% finding from your survey.' },
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
function results() {
  return `<div class="result-scene"><span class="micro">OUR SURVEY</span><div class="result-number">91<small>%</small></div><p>of our respondents shave in their room or washroom.</p><div class="result-blade" aria-hidden="true"><i></i><i></i><i></i></div></div>`;
}

function sceneHtml(state, index) {
  if (state.status === 'lobby') return results();
  if (index === 0) return results();
  if (index === 1) return `<div class="statement-scene"><h2>PRIVATE<br><em>MEETS PUBLIC.</em></h2><p>Half shaved. Middle of Khokha.</p><div class="shave-swipe" aria-hidden="true"></div></div>`;
  if (index === 2) return `<div class="question-scene"><div class="question-mark">?</div><h2>THEY STARE.<br><em>HE DOESN'T.</em></h2><p>Calm in the middle of Khokha.</p></div>`;
  if (index === 3) return `<div class="ad-scene"><div class="ad-frame"><span class="frame-corner top-left"></span><span class="frame-corner bottom-right"></span><img src="/assets/gillette_wordmark_on_black_bg.png" alt="Gillette"></div><span class="side-note">LOOK UP.</span></div>`;
  return `<div class="final-scene"><h2><span>NOT FOR THEM.</span><em>FOR YOURSELF.</em></h2><p>Unbothered. Unshaken. Unmistakably Gillette.</p></div>`;
}

function render(state) {
  latest = state;
  const index = Math.min(4, Math.floor(state.elapsedMs / 60000));
  if (isPresenter) {
    $('#presenter-clock').textContent = clock(state.elapsedMs);
    $('#status-text').textContent = state.status.toUpperCase();
    $('#phase-name').textContent = state.status === 'lobby' ? '91% survey finding' : chapters[index].name;
    $('#phase-cue').textContent = state.status === 'lobby' ? 'Let everyone finish the two questions, then reveal the finding.' : chapters[index].cue;
    $('#start').disabled = !['lobby', 'paused'].includes(state.status);
    $('#start').innerHTML = state.status === 'paused' ? 'RESUME <span>↗</span>' : 'START 5:00 <span>↗</span>';
    $('#pause').disabled = state.status !== 'running';
    return;
  }
  const voted = localStorage.getItem('ss100-voted') === '1';
  $('#survey').hidden = voted;
  $('#experience').hidden = !voted;
  if (!voted) return;
  $('#audience-clock').textContent = clock(state.elapsedMs);
  $('#live-indicator').textContent = state.status === 'lobby' ? 'WAITING' : state.status === 'paused' ? 'PAUSED' : state.status === 'ended' ? 'FINISHED' : 'LIVE';
  const key = state.status === 'lobby' ? 'lobby' : String(index);
  if (key !== lastScene) {
    $('#scene').innerHTML = sceneHtml(state, index);
    $('#scene').classList.remove('arrive');
    void $('#scene').offsetWidth;
    $('#scene').classList.add('arrive');
    lastScene = key;
  }
  $('#scene-label').textContent = state.status === 'lobby' ? 'SURVEY RESULT' : `${String(index + 1).padStart(2, '0')} / 05`;
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
} else {
  const steps = [...document.querySelectorAll('#survey-form fieldset')];
  let step = 0;
  function showStep(next) {
    step = next;
    steps.forEach((field, index) => field.hidden = index !== step);
    $('#step-count').textContent = `0${step + 1} / 0${steps.length}`;
    $('#progress-fill').style.transform = `scaleX(${(step + 1) / steps.length})`;
    $('#back-step').hidden = step === 0;
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
  $('#survey-form').addEventListener('submit', event => {
    event.preventDefault();
    localStorage.setItem('ss100-voted', '1');
    render(latest || { status: 'lobby', elapsedMs: 0 });
  });
}

if (!isPresenter) render({ status: 'lobby', elapsedMs: 0 });
refresh();
setInterval(refresh, 1500);
