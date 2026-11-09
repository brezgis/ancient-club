// Everything on screen that isn't the 3D club: the loading card, the HUD, conversations,
// and the papyrus / credits / help overlays.
import { SCRIPT_LABEL } from './slab.js';

const $ = (id) => document.getElementById(id);

// Write HTML only when it changes, so per-frame callers don't thrash the DOM.
function show(el, html) {
  const on = html != null;
  if (on && el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; }
  el.classList.toggle('show', on);
}

// --- loading card -------------------------------------------------------------------
export function setLoading(fraction) {
  $('enter').style.setProperty('--progress', `${Math.round(fraction * 100)}%`);
}
export function setReady(onEnter) {
  const b = $('enter');
  b.disabled = false;
  b.textContent = 'Enter';
  b.style.setProperty('--progress', '100%');
  b.addEventListener('click', onEnter, { once: true });
  b.focus();
}
export function hideTitle() { $('title').classList.add('hide'); }

// --- HUD --------------------------------------------------------------------------
export const setPrompt = (html) => show($('prompt'), html);
export const setCaption = (html) => show($('caption'), html);
export const setPaused = (on) => $('paused').classList.toggle('show', on);
export const showLost = () => $('lost').classList.add('show');

export function setWallet({ deben, drinks }) {
  $('wallet').innerHTML = `<span class="deben">${deben}</span> deben${drinks ? ` · ${'🍷'.repeat(Math.min(drinks, 6))}` : ''}`;
}
export function setNowPlaying(track) {
  $('nowplaying').innerHTML = `<span class="np-note">♪</span> ${track.name} <span class="np-sub">${track.subtitle}</span>`;
}

let toastTimer;
export function toast(msg) {
  const t = $('toast');
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// --- conversations ----------------------------------------------------------------
// A character is { name, subtitle, start, nodes: { id: { text, options, onEnter?, action? } } };
// text and options may be functions of the game state. Options either go to a node (`to`,
// null to leave) or run an action through onAction, which may redirect to another node.
export class Dialogue {
  constructor(state, { onAction, onClose }) {
    this.state = state;
    this.onAction = onAction;
    this.onClose = onClose;
    this.person = null;
    this.node = null;
    this.options = [];
  }

  get isOpen() { return this.person !== null; }

  open(person) {
    this.person = person;
    $('dname').textContent = person.character.name;
    $('dsub').textContent = person.character.subtitle ?? '';
    $('dialogue').classList.add('show');
    this.goto(person.character.start);
  }

  close() {
    if (!this.person) return;
    const person = this.person;
    this.person = null;
    $('dialogue').classList.remove('show');
    this.onClose(person);
  }

  goto(id) {
    if (id === null) return this.close();
    if (!this.person) return;
    const node = this.person.character.nodes[id];
    const st = this.state;
    this.node = id;
    node.onEnter?.(st);
    if (node.action) this.onAction(node.action, this.person);
    $('dtext').innerHTML = typeof node.text === 'function' ? node.text(st) : node.text;
    $('dtext').scrollTop = 0;
    this.options = typeof node.options === 'function' ? node.options(st) : node.options;
    const box = $('options');
    box.classList.toggle('many', this.options.length > 4);
    box.replaceChildren(...this.options.map((o, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<kbd>${i + 1}</kbd><span>${o.label}</span>`;
      b.disabled = !!o.disabled;
      b.onclick = () => this.choose(i);
      return b;
    }));
  }

  choose(i) {
    const o = this.options[i];
    if (!o || o.disabled) return;
    if (o.action) {
      const next = this.onAction(o.action, this.person);
      if (next !== undefined) return this.goto(next);
    }
    this.goto(o.to === undefined ? this.node : o.to);
  }
}

// --- overlays ---------------------------------------------------------------------
const OVERLAYS = ['journal', 'credits', 'help'];
export const overlayOpen = () => OVERLAYS.some(id => $(id).classList.contains('show'));
export function openOverlay(id) { $(id).classList.add('show'); }
export function closeOverlays() { for (const id of OVERLAYS) $(id).classList.remove('show'); }

export function renderJournal(state) {
  const entries = [...state.journal.values()];
  const body = $('journal-body');
  if (!entries.length) {
    body.innerHTML = '<p class="empty">Nothing here yet. Translate an inscription, talk to a statue, or buy a drink.</p>';
    return;
  }
  body.innerHTML = entries.map(e => e.stages
    ? `<div class="entry"><h3>${e.title}</h3>${e.stages.map(s => `<div class="st st-${s.script}"><span class="lab">${SCRIPT_LABEL[s.script]}</span> ${s.script === 'hiero' ? `<code>${s.text}</code>` : s.text}</div>`).join('')}<p class="note">${e.note ?? ''}</p></div>`
    : `<div class="entry"><h3>${e.title}</h3>${e.lines.map(l => `<p class="note">${l}</p>`).join('')}</div>`,
  ).join('') + (state.learned.size ? `<div class="entry"><h3>Words from Nefertiti</h3><p>${[...state.learned].map(w => `<i>${w}</i>`).join(', ')}</p></div>` : '');
}

export function renderCredits(manifest) {
  $('credits-models').innerHTML = manifest.map(m => `<li><b>${m.title}</b>${m.museum ? `, ${m.museum}` : ''}${m.accession_number ? ` (${m.accession_number})` : ''}<br>
    <span class="lic">${m.license ?? ''}${m.attribution ? ' · ' + m.attribution : ''}</span>${m.source_url ? ` · <a href="${m.source_url}" target="_blank" rel="noopener">source</a>` : ''}</li>`).join('')
    || '<li>No scans loaded. The statues are stand-ins.</li>';
}
