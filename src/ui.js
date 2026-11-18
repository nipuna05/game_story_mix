import { esc, fmtTime } from './util.js';
import { armoryScreen, controlsScreen } from './armory.js';
import { GAME_TITLE, CAMPAIGN, INTRO, DECISIONS, ENDINGS, APPROACHES, DEFAULT_CAST, CAST_LABELS, BUILDER_OBJECTIVES, fill, buildCustom } from './story.js';
import { LOCATIONS } from './locations.js';
import { THEMES } from './world.js';

const controlsList = (L) => [
  ['On foot', [[`${L('KeyW')} ${L('KeyA')} ${L('KeyS')} ${L('KeyD')}`, 'Move'], ['Mouse', 'Look / aim'], [L('ShiftLeft'), 'Sprint (noisy)'], [L('KeyC'), 'Crouch - crouch-walking is slow and quiet'], [L('KeyZ'), 'Crawl - lie prone: slowest, quietest, hardest to see'], [L('KeyV'), 'Hold to sneak-walk while standing'], [L('Space'), 'Jump · stand up from crawling'],
    ['Left mouse', 'Fire / punch'], ['Right mouse', 'Aim · sniper scope · block (fists)'], [L('KeyR'), 'Reload'], ['1 2 3 4 / wheel', 'Fists · sidearm · primary · heavy'],
    [L('KeyF'), 'Kick - silent takedown from behind'], [L('KeyG'), 'Throw grenade'],
    [L('KeyE'), 'Use: pick up a gun (it swaps with the one you hold), enter vehicle, hold to free hostages / plant charges'], [L('KeyU'), 'Drop the gun you hold'],
    [`${L('KeyQ')} ${L('KeyX')} ${L('KeyT')} ${L('KeyY')}`, 'Backpack: medkit · armour plate · noisemaker · ammo box']]],
  ['Car, motorbike & boat', [[`${L('KeyW')} / ${L('KeyS')}`, 'Accelerate / brake and reverse'], [`${L('KeyA')} / ${L('KeyD')}`, 'Steer'], [L('Space'), 'Handbrake'], [L('KeyE'), 'Get out']]],
  ['Aircraft', [[`${L('ShiftLeft')} / ${L('KeyC')}`, 'Throttle up / down'], [`${L('KeyS')} / ${L('KeyW')}`, 'Pull up / push down'], [`${L('KeyA')} / ${L('KeyD')}`, 'Bank left / right'], [L('KeyJ'), 'Bail out in the air'], [L('KeyE'), 'Get out (on the ground, stopped)']]],
  ['Parachute', [[L('Space'), 'Open the canopy during freefall'], [`Mouse or ${L('KeyA')} / ${L('KeyD')}`, 'Steer'], [`${L('KeyW')} / ${L('KeyS')}`, 'Dive faster / flare and slow down']]],
  ['General', [['Gamepad', 'Sticks move and look · RT fire · LT aim · A jump · B crouch · X reload · Y use · LB grenade · RB next weapon · d-pad items · Start pause (menus need the mouse)'], [L('Tab'), 'Show or hide objectives'], [L('KeyB'), 'Change brightness (5 levels)'], [L('KeyK'), 'Show or hide the key list'], [L('KeyM'), 'Mute or unmute sound and music'], [L('KeyH'), 'Field manual'], ['Esc', 'Pause']]],
];
const TIPS = [
  'The diamond over an enemy shows what they know: yellow means suspicious, red means they have seen you.',
  'If a guard stays alerted for a few seconds the alarm is raised and everyone nearby comes looking. Kill fast or break line of sight.',
  'The suppressed pistol can only be heard a few metres away. The rifle and sniper are heard across the whole compound.',
  'Headshots do 2.5x damage. Crouching steadies your aim and shrinks the distance guards can see you from.',
  'Hostages follow you on foot and climb into any car or jeep you drive.',
  'Charges have a six-second fuse and a big blast. Plant, then run.',
  'To take off: hold Shift to full throttle, wait for 120 km/h, then hold S. To land: throttle down, come in shallow and level.',
  'After a death you can continue from your last completed objective - enemies you killed stay dead.',
  'Enemies drop their guns. Pick one up and it swaps with the gun you carry in that slot; racks and ammo crates are hidden in compounds and buildings.',
  'Spend mission credits in the armory: better guns, attachments like a suppressor, body armour and a bigger backpack.',
  'Throw a noisemaker to pull guards away from the route you want to take.',
];

export class UI {
  constructor(g) { this.g = g; this.el = document.getElementById('ui'); this.tabMem = {}; }
  get cast() { return this.g.save.cast; }
  T(s) { return esc(this.g.keyText(fill(s, this.cast))); }
  clear() { this.el.classList.remove('on', 'dark'); this.el.innerHTML = ''; }
  show(html, o = {}) {
    this.el.innerHTML = `<div class="panel ${o.left ? 'left' : ''} ${o.wide ? 'wide' : ''}">${html}</div>`;
    this.el.classList.add('on'); this.el.classList.toggle('dark', !o.left); this.el.classList.toggle('armory', !!o.preview); this.g.previewOn = !!o.preview;
    this.el.scrollTop = 0;
    this.el.querySelectorAll('.tabs[data-tabs]').forEach((bar) => {   // sub-tabs: every pane stays in the page, so typed values are kept
      const id = bar.dataset.tabs;
      bar.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
        this.tabMem[id] = b.dataset.tab; this.g.audio.ui(); this.el.scrollTop = 0;
        bar.querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
        this.el.querySelectorAll(`.pane[data-for="${id}"]`).forEach((p) => p.classList.toggle('on', p.dataset.pane === b.dataset.tab));
      }));
    });
    this.el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => { this.g.audio.init(); this.g.audio.ui(); o.on && o.on(b.dataset.a, b); }));
  }
  q(sel) { return this.el.querySelector(sel); }
  // items: [[key, label, html], ...] -> a tab bar and one pane per item (the remembered or first one is shown)
  tabbed(id, items) {
    const cur = items.some((i) => i[0] === this.tabMem[id]) ? this.tabMem[id] : items[0][0];
    return `<div class="tabs sub" data-tabs="${id}">${items.map(([k, l]) => `<button class="tab ${k === cur ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>`
      + items.map(([k, , h]) => `<div class="pane ${k === cur ? 'on' : ''}" data-for="${id}" data-pane="${k}">${h}</div>`).join('');
  }

  // first screen: browsers only allow sound after a click or key press, so the home music starts here
  splash() {
    this.show(`<h1 class="logo">NIGHTFALL<br><span>PROTOCOL</span></h1><div class="tag">STEALTH · SHOOTING · FIGHTING · RACING · FLYING</div>
      <p class="blink">Click anywhere or press any key to start</p><p class="note">Sound on. Press M at any time to mute.</p>`, { left: true });
    const go = () => { window.removeEventListener('keydown', go, true); this.el.removeEventListener('click', go); this.g.audio.init(); this.title(); };
    window.addEventListener('keydown', go, true); this.el.addEventListener('click', go);
  }
  armory(tab, slot, back) { armoryScreen(this, tab, slot, back); }
  controls(back) { controlsScreen(this, back); }

  // ---------------------------------------------------------------- title
  title() {
    const s = this.g.save, done = s.unlocked > CAMPAIGN.length;
    const hasGame = s.unlocked > 1 || s.started;
    this.show(`
      <h1 class="logo">NIGHTFALL<br><span>PROTOCOL</span></h1>
      <div class="tag">STEALTH · SHOOTING · FIGHTING · RACING · FLYING · RIVERS</div>
      <div class="menu two">
        ${hasGame ? `<button class="primary" data-a="continue">Continue campaign<small>${done ? 'Campaign complete - replay any mission' : this.T('Mission ' + s.unlocked + ': ' + CAMPAIGN[s.unlocked - 1].title)}</small></button>` : ''}
        <button class="${hasGame ? '' : 'primary'}" data-a="new">New campaign<small>${this.T('The story of {hero} and {project}')}</small></button>
        ${hasGame ? '<button data-a="select">Mission select</button>' : ''}
        <button data-a="armory">Profile &amp; armory<small>Credits, weapons, armour, outfit and backpack</small></button>
        <button data-a="builder">Operation builder<small>Write your own story and mission</small></button>
        <button data-a="cast">Cast &amp; names<small>Rename the hero, villain, city - anyone</small></button>
        <button data-a="manual">Field manual<small>Controls and tips</small></button>
        <button data-a="settings">Settings<small>Audio, graphics, controls</small></button>
        <button data-a="feedback">Feedback &amp; issues<small>Report a bug or tell us how to improve the game</small></button>
        <button data-a="invite">Invite a friend<small>Copy the link to share the game</small></button>
      </div>
      ${hasGame ? '' : '<p class="note">Quick start: WASD move · mouse aim · click fire · E use · C crouch · H manual. Stay in the shadows - the guards are watching.</p>'}
      <p class="note" id="inviteNote"></p>`, { left: true, wide: true, on: (a) => {
      if (a === 'invite') return this.invite();
      if (a === 'new') this.castEditor(() => { this.g.newCampaign(); this.intro(0); }, true);
      else if (a === 'continue') (done ? this.select() : this.briefing(CAMPAIGN[s.unlocked - 1]));
      else if (a === 'select') this.select();
      else if (a === 'armory') this.armory('profile', 'rifle', () => this.title());
      else if (a === 'builder') this.builder();
      else if (a === 'cast') this.castEditor(() => this.title());
      else if (a === 'manual') this.manual(() => this.title());
      else if (a === 'settings') this.settings(() => this.title());
      else if (a === 'feedback') this.feedback(() => this.title());
    } });
  }

  castEditor(next, isNew) {
    const c = this.cast;
    this.show(`
      <h2><small>${isNew ? 'NEW CAMPAIGN · STEP 1' : 'MAKE THE STORY YOURS'}</small>Cast &amp; names</h2>
      <p>Every name in the story is yours to change. Type whatever you like - the briefings, radio chatter and endings will all use it.</p>
      ${(() => {
        const keys = Object.keys(DEFAULT_CAST), fld = (k) => `<div><label class="f">${CAST_LABELS[k][0]}<em>${CAST_LABELS[k][1]}</em></label><input type="text" maxlength="28" data-k="${k}" value="${esc(c[k])}"></div>`;
        const diff = isNew ? `<label class="f">Difficulty</label><select id="diff">${['easy', 'normal', 'hard'].map((d) => `<option value="${d}" ${this.g.save.settings.difficulty === d ? 'selected' : ''}>${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select>` : '';
        return this.tabbed('cast', [['people', 'People', `<div class="grid2">${keys.slice(0, 6).map(fld).join('')}</div>`], ['world', 'World & plot', `<div class="grid2">${keys.slice(6).map(fld).join('')}</div>${diff}`]]);
      })()}
      <div class="row"><button class="primary" data-a="ok">${isNew ? 'Begin the story' : 'Save names'}</button><button data-a="reset">Reset to defaults</button><button data-a="back">Back</button></div>`,
    { on: (a) => {
      if (a === 'back') return this.title();
      if (a === 'reset') { Object.assign(c, DEFAULT_CAST); this.g.persist(); return this.castEditor(next, isNew); }
      this.el.querySelectorAll('input[data-k]').forEach((i) => { const v = i.value.trim(); c[i.dataset.k] = v || DEFAULT_CAST[i.dataset.k]; });
      if (isNew && this.q('#diff')) this.g.save.settings.difficulty = this.q('#diff').value;
      this.g.persist(); next();
    } });
  }

  intro(i) {
    this.show(`<h2><small>${this.T('{city}')} · PROLOGUE ${i + 1}/${INTRO.length}</small>${i === 0 ? 'The quiet life' : i === INTRO.length - 1 ? 'The trail' : '&nbsp;'}</h2>
      <p style="font-size:18px">${this.T(INTRO[i])}</p>
      <div class="row"><button class="primary" data-a="next">${i < INTRO.length - 1 ? 'Continue' : 'Mission briefing'}</button><button data-a="skip">Skip</button></div>`,
    { on: (a) => (a === 'next' && i < INTRO.length - 1 ? this.intro(i + 1) : this.briefing(CAMPAIGN[0])) });
  }

  select() {
    const s = this.g.save;
    this.show(`<h2><small>CAMPAIGN</small>Mission select</h2><div class="menu mlist two">
      ${CAMPAIGN.map((m, i) => `<button data-a="${i}" ${i + 1 > s.unlocked ? 'disabled' : ''}><b>${String(i + 1).padStart(2, '0')}</b>${this.T(m.title)}<small>${esc(LOCATIONS[m.location].name)} · ${THEMES[m.time].label}${s.best[m.id] ? ' · best rank ' + s.best[m.id].rank : ''}</small></button>`).join('')}
      </div><div class="row"><button data-a="back">Back</button></div>`,
    { on: (a) => (a === 'back' ? this.title() : this.briefing(CAMPAIGN[+a])) });
  }

  decision(def, next) {
    const d = DECISIONS[def.decision]; let sel = this.g.save.flags[def.decision] || d.options[0].key;
    const draw = () => this.show(`<h2><small>YOUR STORY · YOUR CHOICE</small>${this.T(d.title)}</h2>${d.text.map((t) => `<p>${this.T(t)}</p>`).join('')}
      ${d.options.map((o) => `<div class="opt ${o.key === sel ? 'sel' : ''}" data-a="${o.key}" style="margin-bottom:8px"><b>${this.T(o.label)}</b><span>${this.T(o.desc)}</span></div>`).join('')}
      <div class="row"><button class="primary" data-a="_ok">Lock it in</button><button data-a="_back">Back</button></div>`,
    { on: (a) => {
      if (a === '_back') return this.title();
      if (a === '_ok') { this.g.save.flags[def.decision] = sel; this.g.persist(); return next(); }
      sel = a; draw();
    } });
    draw();
  }

  briefing(def, decided) {
    if (def.decision && !decided) return this.decision(def, () => this.briefing(def, true));
    const g = this.g, loc = LOCATIONS[def.location];
    const objs = typeof def.objectives === 'function' ? def.objectives(g.save.flags) : def.objectives;
    let ap = g.save.approach || 'ghost';
    const idx = CAMPAIGN.indexOf(def);
    if (!decided || !this._briefDef || this._briefDef !== def) { this.tabMem.brief = 'story'; this._briefDef = def; }
    const draw = () => this.show(`
      <h2><small>${def.custom ? 'CUSTOM OPERATION' : 'MISSION ' + (idx + 1) + ' OF ' + CAMPAIGN.length} · ${esc(loc.name).toUpperCase()} · ${THEMES[def.time].label.toUpperCase()}</small>${this.T(def.title)}</h2>
      ${this.tabbed('brief', [
        ['story', 'Story', `<p class="note">${esc(loc.tagline)}</p>${def.brief.map((t) => `<p>${this.T(t)}</p>`).join('')}`],
        ['obj', 'Objectives', `<ul class="objs">${objs.map((o) => `<li>${this.T(o.text)}</li>`).join('')}</ul>`],
        ['prep', 'Approach & loadout', `<div class="grid2">${Object.entries(APPROACHES).map(([k, a]) => `<div class="opt ${k === ap ? 'sel' : ''}" data-a="ap:${k}"><b>${a.label}</b><span>${a.desc}</span></div>`).join('')}</div><div class="row"><button data-a="gear">Loadout &amp; backpack</button><button data-a="manual">Field manual</button></div>`],
      ])}
      <div class="row"><button class="primary" data-a="go">Deploy</button><button data-a="back">Back</button></div>
      <p class="note" style="margin-top:10px">Click the game once to capture the mouse. Esc pauses.</p>`,
    { on: (a) => {
      if (a.startsWith('ap:')) { ap = a.slice(3); draw(); }
      else if (a === 'go') { g.save.approach = ap; g.persist(); g.startMission(def, { approach: ap }); }
      else if (a === 'manual') this.manual(() => this.briefing(def, true));
      else if (a === 'gear') this.armory('pack', 'rifle', () => this.briefing(def, true));
      else if (def.custom) this.builder(); else this.title();
    } });
    draw();
  }

  manual(back) {
    const L = controlsList((id) => this.g.input.label(id)), tbl = ([h, rows]) => `<h3>${h.toUpperCase()}</h3><table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
    const grp = (names) => L.filter(([n]) => names.includes(n)).map(tbl).join('');
    this.show(`<h2><small>FIELD MANUAL</small>How to play</h2>
      ${this.tabbed('manual', [
        ['move', 'Move & stealth', tbl(['On foot', (L.find(([n]) => n === 'On foot') || ['', []])[1].slice(0, 7)])],
        ['combat', 'Combat & items', tbl(['On foot', (L.find(([n]) => n === 'On foot') || ['', []])[1].slice(7)])],
        ['veh', 'Vehicles', grp(['Car, motorbike & boat'])],
        ['air', 'Air', grp(['Aircraft', 'Parachute'])],
        ['gen', 'General', grp(['General'])],
        ['tips', 'Tips', `<ul class="objs">${TIPS.slice(0, Math.ceil(TIPS.length / 2)).map((t) => `<li>${t}</li>`).join('')}</ul>`],
        ['tips2', 'More tips', `<ul class="objs">${TIPS.slice(Math.ceil(TIPS.length / 2)).map((t) => `<li>${t}</li>`).join('')}</ul>`],
      ])}
      <div class="row"><button class="primary" data-a="back">Back</button></div>`, { on: back });
  }

  settings(back) {
    const s = this.g.save.settings, sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    this.show(`<h2><small>OPTIONS</small>Settings</h2>
      ${this.tabbed('settings', [
        ['play', 'Gameplay', `<label class="f">Difficulty</label>${sel('diff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], s.difficulty)}
          <label class="f">Mouse sensitivity</label><input type="range" id="sens" min="0.3" max="2.5" step="0.05" value="${s.sens}">
          <label class="f"><input type="checkbox" id="inv" ${s.invertY ? 'checked' : ''}> Invert mouse Y</label>
          <label class="f"><input type="checkbox" id="tips" ${s.tips !== false ? 'checked' : ''}> Show tips and hints while playing</label>`],
        ['audio', 'Audio', `<label class="f">Music volume<em>press M in game to mute everything</em></label><input type="range" id="mvol" min="0" max="1" step="0.05" value="${s.music ?? 0.6}">
          <label class="f">Sound effects volume</label><input type="range" id="vol" min="0" max="1" step="0.05" value="${s.vol}">`],
        ['gfx', 'Graphics', `<label class="f">Brightness<em>raise it if night missions look too dark on your screen (B in game)</em></label><input type="range" id="bright" min="0.7" max="2.4" step="0.05" value="${s.bright || 1.3}">
          <label class="f">Quality</label>${sel('gfx', [['high', 'High - sharp shadows, glow and reflections'], ['medium', 'Medium - smaller shadows, lower resolution'], ['low', 'Low - no shadows or glow (fastest)']], s.quality || (s.shadows ? 'high' : 'low'))}`],
        ['ctrl', 'Controls & data', `<p>Every key can be changed.</p><div class="row" style="margin-top:0"><button data-a="controls">Customize controls</button></div>
          <div class="row" style="margin-top:0"><button data-a="tips">Show all tips again</button></div><h3>DANGER ZONE</h3><div class="row" style="margin-top:0"><button data-a="wipe">Erase campaign progress</button></div>`],
      ])}
      <div class="row"><button class="primary" data-a="ok">Save</button><button data-a="cancel">Cancel</button></div>`,
    { on: (a) => {
      if (a === 'controls') return this.controls(() => this.settings(back));
      if (a === 'wipe') { this.g.wipe(); return this.title(); }
      if (a === 'cancel') return back();
      if (a === 'tips') { this.g.save.hints = {}; this.g.persist(); return this.settings(back); }
      s.sens = +this.q('#sens').value; s.vol = +this.q('#vol').value; s.music = +this.q('#mvol').value; s.bright = +this.q('#bright').value; s.difficulty = this.q('#diff').value; s.quality = this.q('#gfx').value; s.shadows = s.quality !== 'low'; s.invertY = this.q('#inv').checked; s.tips = this.q('#tips').checked;
      this.g.applySettings(); this.g.persist(); back();
    } });
  }

  // feedback: no server, so the report opens as a prefilled GitHub issue the player only has to submit
  feedback(back, ctx) {
    const kinds = [['bug', 'Bug - something is broken'], ['hard', 'Too hard'], ['easy', 'Too easy'], ['idea', 'Idea - something to add'], ['other', 'Something else']];
    const repo = 'https://github.com/nipuna05/game_story_mix';
    this.show(`<h2><small>HELP US IMPROVE</small>Feedback &amp; issues</h2>
      <p>${ctx ? `You are sending feedback about <b>${esc(ctx)}</b> - the mission name is added to your report. ` : ''}Found a bug, a mission that is too hard or too easy, or have an idea? Write it here. Sending opens a new issue on GitHub with your text filled in - you just press <b>Submit new issue</b> there (a free GitHub account is needed).</p>
      <label class="f">What kind of feedback?</label><select id="fb_kind">${kinds.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
      <label class="f">Your message<em>what happened, which mission, what you expected</em></label><textarea id="fb_msg" maxlength="1500" placeholder="Describe it in a few sentences..."></textarea>
      <p class="note" id="fb_note"></p>
      <div class="row"><button class="primary" data-a="send">Open on GitHub</button><button data-a="copy">Copy text</button><button data-a="issues">See existing issues</button><button data-a="back">Back</button></div>`,
    { on: (a) => {
      if (a === 'back') return back();
      const kind = this.q('#fb_kind').value, msg = this.q('#fb_msg').value.trim(), note = this.q('#fb_note');
      const label = kinds.find((k) => k[0] === kind)[1].split(' - ')[0];
      if (a === 'issues') return void window.open(repo + '/issues', '_blank', 'noopener');
      if (!msg) { note.textContent = 'Please write a short message first.'; return; }
      if (a === 'copy') {
        const done = () => { note.textContent = 'Copied. Paste it wherever you want to send it.'; };
        if (navigator.clipboard) navigator.clipboard.writeText(`[${label}] ${msg}${ctx ? ` (Mission: ${ctx})` : ''}`).then(done, () => { note.textContent = 'Could not copy automatically - select the text and copy it.'; }); else note.textContent = 'Could not copy automatically - select the text and copy it.';
        return;
      }
      const NL = String.fromCharCode(10);
      const body = ctx ? msg + NL + NL + '---' + NL + 'Mission: ' + ctx : msg;
      const url = `${repo}/issues/new?title=${encodeURIComponent(`[${label}] ${msg.split(NL)[0].slice(0, 60)}`)}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank', 'noopener');
      note.textContent = 'GitHub opened in a new tab. Thank you!';
    } });
  }

  pause() {
    this.show(`<h2><small>PAUSED</small>${this.T(this.g.def.title)}</h2>
      <div class="menu"><button class="primary" data-a="resume">Resume</button><button data-a="manual">Field manual</button><button data-a="settings">Settings</button><button data-a="feedback">Feedback &amp; issues</button><button data-a="restart">Restart mission</button><button data-a="quit">Quit to main menu</button></div>`,
    { left: true, on: (a) => {
      const g = this.g;
      if (a === 'resume') g.resume();
      else if (a === 'manual') this.manual(() => this.pause());
      else if (a === 'settings') this.settings(() => this.pause());
      else if (a === 'feedback') this.feedback(() => this.pause(), this.T(this.g.def.title));
      else if (a === 'restart') g.startMission(g.def, { approach: g.approach });
      else g.toMenu();
    } });
  }

  fail(reason, canContinue) {
    this.show(`<h2 style="color:var(--bad)"><small>MISSION FAILED</small>${esc(reason)}</h2>
      <div class="menu" style="margin-top:18px">
        ${canContinue ? '<button class="primary" data-a="cp">Continue from last objective<small>Enemies you killed stay dead</small></button>' : ''}
        <button class="${canContinue ? '' : 'primary'}" data-a="restart">Restart mission</button><button data-a="feedback">Send feedback</button><button data-a="quit">Quit to main menu</button></div>`,
    { left: true, on: (a) => { const g = this.g; if (a === 'feedback') return this.feedback(() => this.fail(reason, canContinue), this.T(g.def.title)); if (a === 'cp') g.continueCheckpoint(); else if (a === 'restart') g.startMission(g.def, { approach: g.approach }); else g.toMenu(); } });
  }

  debrief(r) {
    const g = this.g, def = g.def, idx = CAMPAIGN.indexOf(def), last = idx === CAMPAIGN.length - 1;
    const st = r.stats;
    this.show(`<div class="rank">${r.rank}</div><h2 style="color:var(--ok)"><small>MISSION COMPLETE</small>${this.T(def.title)}</h2>
      <div class="stats">
        <div><b>${fmtTime(st.time)}</b><span>TIME</span></div><div><b>${st.kills}</b><span>KILLS</span></div><div><b>${st.headshots}</b><span>HEADSHOTS</span></div><div><b>${st.takedowns}</b><span>TAKEDOWNS</span></div>
        <div><b>${st.shots ? Math.round(st.hits / st.shots * 100) : 0}%</b><span>ACCURACY</span></div><div><b>${st.alarms}</b><span>ALARMS</span></div><div><b>${st.deaths}</b><span>DEATHS</span></div><div><b>${r.score}</b><span>SCORE</span></div>
      </div>
      <p class="note" style="color:var(--acc)">+${r.credits || 0} credits · +${r.score} XP</p>
      <p class="note">${st.alarms === 0 ? 'Ghost bonus: no alarm was raised.' : 'An alarm was raised - no ghost bonus.'}</p>
      ${(def.outro || []).map((t) => `<p>${this.T(t)}</p>`).join('')}
      <div class="row"><button class="primary" data-a="next">${def.custom ? 'Back to builder' : last ? 'See how it ends' : 'Next mission'}</button><button data-a="share">Share result</button><button data-a="again">Play again</button><button data-a="feedback">Send feedback</button><button data-a="menu">Main menu</button></div><p class="note" id="shareNote"></p>`,
    { on: (a) => {
      if (a === 'share') return this.shareResult(r, def);
      if (a === 'feedback') return this.feedback(() => this.debrief(r), this.T(def.title));
      if (a === 'again') return g.startMission(def, { approach: g.approach });
      g.toMenu(true);
      if (a === 'menu') return this.title();
      if (def.custom) return this.builder();
      if (last) return this.ending(g.save.flags.ending || 'savior');
      this.briefing(CAMPAIGN[idx + 1]);
    } });
  }

  // ---------------------------------------------------------------- sharing
  gameUrl() { return location.origin + location.pathname; }
  sheet() { return !!navigator.share && matchMedia('(pointer: coarse)').matches; }   // the system share sheet is for phones and tablets; desktops copy instead
  invite() {
    const note = this.q('#inviteNote'), text = `Nightfall Protocol - a free 3D stealth, shooting and flying game that runs in your browser. ${this.gameUrl()}`;
    if (this.sheet()) return navigator.share({ title: 'Nightfall Protocol', text, url: this.gameUrl() }).catch(() => {});
    const done = () => { if (note) note.textContent = 'Link copied - paste it to a friend.'; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => { if (note) note.textContent = this.gameUrl(); }); else if (note) note.textContent = this.gameUrl();
  }
  // draws the result card (1200x630) for the share image
  shareCard(r, def) {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const x = c.getContext('2d'), st = r.stats;
    const g = x.createLinearGradient(0, 0, 1200, 630); g.addColorStop(0, '#0b1220'); g.addColorStop(1, '#1d2b45'); x.fillStyle = g; x.fillRect(0, 0, 1200, 630);
    x.fillStyle = '#ffb23e'; x.fillRect(0, 0, 14, 630);
    x.textBaseline = 'alphabetic'; x.fillStyle = '#ffb23e'; x.font = 'bold 30px system-ui, sans-serif'; x.fillText('NIGHTFALL PROTOCOL', 60, 80);
    x.fillStyle = '#8fa3c4'; x.font = '24px system-ui, sans-serif'; x.fillText('MISSION COMPLETE', 60, 125);
    x.fillStyle = '#ffffff'; x.font = 'bold 58px system-ui, sans-serif'; x.fillText(String(this.T(def.title)).replace(/&amp;/g, '&').replace(/&#39;/g, "'").slice(0, 28), 60, 205);
    x.fillStyle = '#ffb23e'; x.font = 'bold 300px system-ui, sans-serif'; x.textAlign = 'right'; x.fillText(r.rank, 1140, 420); x.textAlign = 'left';
    const rows = [['TIME', fmtTime(st.time)], ['SCORE', String(r.score)], ['KILLS', String(st.kills)], ['ACCURACY', (st.shots ? Math.round(st.hits / st.shots * 100) : 0) + '%'], ['ALARMS', String(st.alarms)]];
    rows.forEach(([k, v], i) => { const px = 60 + (i % 3) * 230, py = 300 + Math.floor(i / 3) * 120; x.fillStyle = '#8fa3c4'; x.font = '20px system-ui, sans-serif'; x.fillText(k, px, py); x.fillStyle = '#fff'; x.font = 'bold 48px system-ui, sans-serif'; x.fillText(v, px, py + 50); });
    x.fillStyle = st.alarms === 0 ? '#5be38a' : '#8fa3c4'; x.font = 'bold 26px system-ui, sans-serif'; x.fillText(st.alarms === 0 ? 'GHOST - no alarm raised' : '', 60, 520);
    x.fillStyle = '#8fa3c4'; x.font = '24px system-ui, sans-serif'; x.fillText('Play free in your browser: ' + this.gameUrl().replace(/^https?:\/\//, ''), 60, 590);
    return c;
  }
  async shareResult(r, def) {
    const note = this.q('#shareNote'), say = (t) => { if (note) note.textContent = t; };
    const title = String(this.T(def.title)).replace(/&amp;/g, '&').replace(/&#39;/g, "'"), st = r.stats;
    const text = `I cleared "${title}" in Nightfall Protocol - rank ${r.rank}, ${fmtTime(st.time)}, score ${r.score}${st.alarms === 0 ? ', no alarms (Ghost)' : ''}. Can you beat it?`;
    const canvas = this.shareCard(r, def);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    try {
      const file = blob && new File([blob], 'nightfall-result.png', { type: 'image/png' });
      if (this.sheet() && navigator.canShare && file && navigator.canShare({ files: [file] })) return await navigator.share({ title: 'Nightfall Protocol', text, url: this.gameUrl(), files: [file] });
      if (this.sheet()) return await navigator.share({ title: 'Nightfall Protocol', text, url: this.gameUrl() });
    } catch (e) { if (e && e.name === 'AbortError') return; }
    // no share sheet (desktop): copy the text and save the picture
    if (navigator.clipboard) await navigator.clipboard.writeText(`${text} ${this.gameUrl()}`).catch(() => {});
    if (blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nightfall-result.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    say('Result text copied and the card image saved - paste both into your chat or post.');
  }

  ending(key) {
    const e = ENDINGS[key];
    this.show(`<h2><small>${GAME_TITLE}</small>${e.title}</h2>${e.text.map((t) => `<p style="font-size:17px">${this.T(t)}</p>`).join('')}
      <p class="note">There are three endings. Replay the final mission and choose differently to see the others - or write your own operation in the builder.</p>
      <div class="row"><button class="primary" data-a="menu">Main menu</button></div>`, { on: () => this.title() });
  }

  // ---------------------------------------------------------------- operation builder
  builder(edit) {
    const g = this.g, list = g.save.custom;
    const f = edit || { title: '', story: '', radio: '', leader: '', location: 'harbor', time: 'night', insertion: 'foot', exit: 'reach', objectives: ['collect', 'kill'], count: 3, enemies: 1 };
    const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${v}" ${v === String(cur) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    if (!this._bOpen) { this.tabMem.builder = 'story'; this._bOpen = true; }
    this.show(`<h2><small>OPERATION BUILDER</small>Write your own mission</h2>
      ${this.tabbed('builder', [
        ['story', 'Story', `<label class="f">Operation title</label><input type="text" id="b_title" maxlength="40" placeholder="e.g. Midnight Harvest" value="${esc(f.title)}">
          <label class="f">Your story / briefing<em>new line for a new paragraph. You can use {hero}, {villain}, {city} ...</em></label><textarea id="b_story" maxlength="1500" placeholder="Write what is happening and why the hero is going in...">${esc(f.story)}</textarea>
          <div class="grid2"><div><label class="f">Opening radio message</label><input type="text" id="b_radio" maxlength="160" placeholder="First thing your handler says" value="${esc(f.radio)}"></div>
          <div><label class="f">Enemy leader's name</label><input type="text" id="b_leader" maxlength="28" placeholder="e.g. The Jackal" value="${esc(f.leader)}"></div></div>`],
        ['setup', 'Setup', `<div class="grid2">
          <div><label class="f">District</label>${sel('b_loc', Object.entries(LOCATIONS).map(([k, l]) => [k, l.name]), f.location)}</div>
          <div><label class="f">Time of day</label>${sel('b_time', Object.entries(THEMES).map(([k, t]) => [k, t.label]), f.time)}</div>
          <div><label class="f">How you arrive</label>${sel('b_ins', [['foot', 'On foot'], ['car', 'By car'], ['bike', 'By motorbike'], ['boat', 'By boat (forest only)'], ['parachute', 'Fly in and parachute']], f.insertion)}</div>
          <div><label class="f">How you leave</label>${sel('b_exit', [['reach', 'Reach the extraction point'], ['flyout', 'Steal a plane and fly out']], f.exit)}</div>
          <div><label class="f">Items / hostages / targets each</label>${sel('b_count', [['1', '1'], ['2', '2'], ['3', '3']], f.count)}</div>
          <div><label class="f">Enemy presence</label>${sel('b_en', [['0.6', 'Light'], ['1', 'Normal'], ['1.4', 'Heavy']], f.enemies)}</div></div>`],
        ['todo', 'Objectives', `<label class="f">What must be done<em>played in this order</em></label><div class="checks">${BUILDER_OBJECTIVES.map(([k, l]) => `<label><input type="checkbox" data-o="${k}" ${f.objectives.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>`],
        ['saved', `Saved (${list.length})`, list.length ? `<div class="menu mlist">${list.map((m, i) => `<div style="display:flex;gap:8px"><button style="flex:1" data-a="play:${i}"><b>▶</b>${esc(m.title || 'Untitled Operation')}<small>${esc(LOCATIONS[m.location].name)} · ${THEMES[m.time].label}</small></button><button data-a="edit:${i}">Edit</button><button data-a="del:${i}">Delete</button></div>`).join('')}</div>` : '<p class="note">Nothing saved yet. Fill in the other tabs and press Save &amp; play.</p>'],
      ])}
      <div class="row"><button class="primary" data-a="save">${edit ? 'Save changes &amp; play' : 'Save &amp; play'}</button><button data-a="back">Back</button></div>`,
    { on: (a) => {
      if (a === 'back') { this._bOpen = false; return this.title(); }
      const [cmd, i] = a.split(':');
      if (cmd === 'play') { this._bOpen = false; return this.briefing(buildCustom(list[+i])); }
      if (cmd === 'edit') { this.tabMem.builder = 'story'; return this.builder({ ...list[+i], _i: +i }); }
      if (cmd === 'del') { list.splice(+i, 1); g.persist(); return this.builder(); }
      const form = {
        id: f.id || 'c' + Date.now(), title: this.q('#b_title').value.trim(), story: this.q('#b_story').value.trim(), radio: this.q('#b_radio').value.trim(), leader: this.q('#b_leader').value.trim(),
        location: this.q('#b_loc').value, time: this.q('#b_time').value, insertion: this.q('#b_ins').value, exit: this.q('#b_exit').value, count: +this.q('#b_count').value, enemies: +this.q('#b_en').value,
        objectives: [...this.el.querySelectorAll('input[data-o]')].filter((c) => c.checked).map((c) => c.dataset.o),
      };
      if (f._i != null) list[f._i] = form; else list.push(form);
      g.persist(); this._bOpen = false;
      this.briefing(buildCustom(form));
    } });
  }
}
