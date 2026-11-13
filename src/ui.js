import { esc, fmtTime } from './util.js';
import { GAME_TITLE, CAMPAIGN, INTRO, DECISIONS, ENDINGS, APPROACHES, DEFAULT_CAST, CAST_LABELS, BUILDER_OBJECTIVES, fill, buildCustom } from './story.js';
import { LOCATIONS } from './locations.js';
import { THEMES } from './world.js';

const CONTROLS = [
  ['On foot', [['W A S D', 'Move'], ['Mouse', 'Look / aim'], ['Shift', 'Sprint (noisy)'], ['C', 'Crouch - quieter and harder to see'], ['Space', 'Jump'],
    ['Left mouse', 'Fire / punch'], ['Right mouse', 'Aim · sniper scope · block (fists)'], ['R', 'Reload'], ['1 2 3 4 / wheel', 'Fists · pistol · rifle · sniper'],
    ['F', 'Kick - silent takedown from behind'], ['G', 'Throw grenade'], ['E', 'Enter vehicle · hold to free hostages / plant charges']]],
  ['Car & motorbike', [['W / S', 'Accelerate / brake and reverse'], ['A / D', 'Steer'], ['Space', 'Handbrake'], ['E', 'Get out']]],
  ['Aircraft', [['Shift / C', 'Throttle up / down'], ['S / W', 'Pull up / push down'], ['A / D', 'Bank left / right'], ['J', 'Bail out in the air'], ['E', 'Get out (on the ground, stopped)']]],
  ['Parachute', [['Space', 'Open the canopy during freefall'], ['Mouse or A / D', 'Steer'], ['W / S', 'Dive faster / flare and slow down']]],
  ['General', [['Tab', 'Show or hide objectives'], ['H', 'Field manual'], ['Esc', 'Pause']]],
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
];

export class UI {
  constructor(g) { this.g = g; this.el = document.getElementById('ui'); }
  get cast() { return this.g.save.cast; }
  T(s) { return esc(fill(s, this.cast)); }
  clear() { this.el.classList.remove('on', 'dark'); this.el.innerHTML = ''; }
  show(html, o = {}) {
    this.el.innerHTML = `<div class="panel ${o.left ? 'left' : ''}">${html}</div>`;
    this.el.classList.add('on'); this.el.classList.toggle('dark', !o.left);
    this.el.scrollTop = 0;
    this.el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => { this.g.audio.init(); this.g.audio.ui(); o.on && o.on(b.dataset.a, b); }));
  }
  q(sel) { return this.el.querySelector(sel); }

  // ---------------------------------------------------------------- title
  title() {
    const s = this.g.save, done = s.unlocked > CAMPAIGN.length;
    const hasGame = s.unlocked > 1 || s.started;
    this.show(`
      <h1 class="logo">NIGHTFALL<br><span>PROTOCOL</span></h1>
      <div class="tag">STEALTH · SHOOTING · FIGHTING · RACING · FLYING</div>
      <div class="menu">
        ${hasGame ? `<button class="primary" data-a="continue">Continue campaign<small>${done ? 'Campaign complete - replay any mission' : this.T('Mission ' + s.unlocked + ': ' + CAMPAIGN[s.unlocked - 1].title)}</small></button>` : ''}
        <button class="${hasGame ? '' : 'primary'}" data-a="new">New campaign<small>${this.T('The story of {hero} and {project}')}</small></button>
        ${hasGame ? '<button data-a="select">Mission select</button>' : ''}
        <button data-a="builder">Operation builder<small>Write your own story and mission</small></button>
        <button data-a="cast">Cast &amp; names<small>Rename the hero, villain, city - anyone</small></button>
        <button data-a="manual">Field manual<small>Controls and tips</small></button>
        <button data-a="settings">Settings</button>
      </div>`, { left: true, on: (a) => {
      if (a === 'new') this.castEditor(() => { this.g.newCampaign(); this.intro(0); }, true);
      else if (a === 'continue') (done ? this.select() : this.briefing(CAMPAIGN[s.unlocked - 1]));
      else if (a === 'select') this.select();
      else if (a === 'builder') this.builder();
      else if (a === 'cast') this.castEditor(() => this.title());
      else if (a === 'manual') this.manual(() => this.title());
      else if (a === 'settings') this.settings(() => this.title());
    } });
  }

  castEditor(next, isNew) {
    const c = this.cast;
    this.show(`
      <h2><small>${isNew ? 'NEW CAMPAIGN · STEP 1' : 'MAKE THE STORY YOURS'}</small>Cast &amp; names</h2>
      <p>Every name in the story is yours to change. Type whatever you like - the briefings, radio chatter and endings will all use it.</p>
      <div class="grid2">
        ${Object.keys(DEFAULT_CAST).map((k) => `<div><label class="f">${CAST_LABELS[k][0]}<em>${CAST_LABELS[k][1]}</em></label><input type="text" maxlength="28" data-k="${k}" value="${esc(c[k])}"></div>`).join('')}
      </div>
      ${isNew ? `<label class="f">Difficulty</label><select id="diff">${['easy', 'normal', 'hard'].map((d) => `<option value="${d}" ${this.g.save.settings.difficulty === d ? 'selected' : ''}>${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select>` : ''}
      <div class="row"><button class="primary" data-a="ok">${isNew ? 'Begin the story' : 'Save names'}</button><button data-a="reset">Reset to defaults</button><button data-a="back">Back</button></div>`,
    { on: (a) => {
      if (a === 'back') return this.title();
      if (a === 'reset') { Object.assign(c, DEFAULT_CAST); this.g.persist(); return this.castEditor(next, isNew); }
      this.el.querySelectorAll('input[data-k]').forEach((i) => { const v = i.value.trim(); c[i.dataset.k] = v || DEFAULT_CAST[i.dataset.k]; });
      if (isNew) this.g.save.settings.difficulty = this.q('#diff').value;
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
    this.show(`<h2><small>CAMPAIGN</small>Mission select</h2><div class="menu mlist">
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
    const draw = () => this.show(`
      <h2><small>${def.custom ? 'CUSTOM OPERATION' : 'MISSION ' + (idx + 1) + ' OF ' + CAMPAIGN.length} · ${esc(loc.name).toUpperCase()} · ${THEMES[def.time].label.toUpperCase()}</small>${this.T(def.title)}</h2>
      <p class="note">${esc(loc.tagline)}</p>
      ${def.brief.map((t) => `<p>${this.T(t)}</p>`).join('')}
      <h3>OBJECTIVES</h3><ul class="objs">${objs.map((o) => `<li>${this.T(o.text)}</li>`).join('')}</ul>
      <h3>APPROACH</h3><div class="grid2">${Object.entries(APPROACHES).map(([k, a]) => `<div class="opt ${k === ap ? 'sel' : ''}" data-a="ap:${k}"><b>${a.label}</b><span>${a.desc}</span></div>`).join('')}</div>
      <div class="row"><button class="primary" data-a="go">Deploy</button><button data-a="manual">Field manual</button><button data-a="back">Back</button></div>
      <p class="note" style="margin-top:14px">Click the game once to capture the mouse. Esc pauses.</p>`,
    { on: (a) => {
      if (a.startsWith('ap:')) { ap = a.slice(3); draw(); }
      else if (a === 'go') { g.save.approach = ap; g.persist(); g.startMission(def, { approach: ap }); }
      else if (a === 'manual') this.manual(() => this.briefing(def, true));
      else if (def.custom) this.builder(); else this.title();
    } });
    draw();
  }

  manual(back) {
    this.show(`<h2><small>FIELD MANUAL</small>How to play</h2>
      ${CONTROLS.map(([h, rows]) => `<h3>${h.toUpperCase()}</h3><table>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`).join('')}
      <h3>TIPS</h3><ul class="objs">${TIPS.map((t) => `<li>${t}</li>`).join('')}</ul>
      <div class="row"><button class="primary" data-a="back">Back</button></div>`, { on: back });
  }

  settings(back) {
    const s = this.g.save.settings;
    this.show(`<h2><small>OPTIONS</small>Settings</h2>
      <label class="f">Mouse sensitivity</label><input type="range" id="sens" min="0.3" max="2.5" step="0.05" value="${s.sens}">
      <label class="f">Volume</label><input type="range" id="vol" min="0" max="1" step="0.05" value="${s.vol}">
      <label class="f">Difficulty</label><select id="diff">${['easy', 'normal', 'hard'].map((d) => `<option value="${d}" ${s.difficulty === d ? 'selected' : ''}>${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select>
      <label class="f">Graphics</label><select id="gfx"><option value="high" ${s.shadows ? 'selected' : ''}>High - shadows on</option><option value="low" ${s.shadows ? '' : 'selected'}>Low - shadows off (faster)</option></select>
      <label class="f"><input type="checkbox" id="inv" ${s.invertY ? 'checked' : ''}> Invert mouse Y</label>
      <div class="row"><button class="primary" data-a="ok">Save</button><button data-a="wipe">Erase campaign progress</button></div>`,
    { on: (a) => {
      if (a === 'wipe') { this.g.wipe(); return this.title(); }
      s.sens = +this.q('#sens').value; s.vol = +this.q('#vol').value; s.difficulty = this.q('#diff').value; s.shadows = this.q('#gfx').value === 'high'; s.invertY = this.q('#inv').checked;
      this.g.applySettings(); this.g.persist(); back();
    } });
  }

  pause() {
    this.show(`<h2><small>PAUSED</small>${this.T(this.g.def.title)}</h2>
      <div class="menu"><button class="primary" data-a="resume">Resume</button><button data-a="manual">Field manual</button><button data-a="settings">Settings</button><button data-a="restart">Restart mission</button><button data-a="quit">Quit to main menu</button></div>`,
    { left: true, on: (a) => {
      const g = this.g;
      if (a === 'resume') g.resume();
      else if (a === 'manual') this.manual(() => this.pause());
      else if (a === 'settings') this.settings(() => this.pause());
      else if (a === 'restart') g.startMission(g.def, { approach: g.approach });
      else g.toMenu();
    } });
  }

  fail(reason, canContinue) {
    this.show(`<h2 style="color:var(--bad)"><small>MISSION FAILED</small>${esc(reason)}</h2>
      <div class="menu" style="margin-top:18px">
        ${canContinue ? '<button class="primary" data-a="cp">Continue from last objective<small>Enemies you killed stay dead</small></button>' : ''}
        <button class="${canContinue ? '' : 'primary'}" data-a="restart">Restart mission</button><button data-a="quit">Quit to main menu</button></div>`,
    { left: true, on: (a) => { const g = this.g; if (a === 'cp') g.continueCheckpoint(); else if (a === 'restart') g.startMission(g.def, { approach: g.approach }); else g.toMenu(); } });
  }

  debrief(r) {
    const g = this.g, def = g.def, idx = CAMPAIGN.indexOf(def), last = idx === CAMPAIGN.length - 1;
    const st = r.stats;
    this.show(`<div class="rank">${r.rank}</div><h2 style="color:var(--ok)"><small>MISSION COMPLETE</small>${this.T(def.title)}</h2>
      <div class="stats">
        <div><b>${fmtTime(st.time)}</b><span>TIME</span></div><div><b>${st.kills}</b><span>KILLS</span></div><div><b>${st.headshots}</b><span>HEADSHOTS</span></div><div><b>${st.takedowns}</b><span>TAKEDOWNS</span></div>
        <div><b>${st.shots ? Math.round(st.hits / st.shots * 100) : 0}%</b><span>ACCURACY</span></div><div><b>${st.alarms}</b><span>ALARMS</span></div><div><b>${st.deaths}</b><span>DEATHS</span></div><div><b>${r.score}</b><span>SCORE</span></div>
      </div>
      <p class="note">${st.alarms === 0 ? 'Ghost bonus: no alarm was raised.' : 'An alarm was raised - no ghost bonus.'}</p>
      ${(def.outro || []).map((t) => `<p>${this.T(t)}</p>`).join('')}
      <div class="row"><button class="primary" data-a="next">${def.custom ? 'Back to builder' : last ? 'See how it ends' : 'Next mission'}</button><button data-a="again">Play again</button><button data-a="menu">Main menu</button></div>`,
    { on: (a) => {
      if (a === 'again') return g.startMission(def, { approach: g.approach });
      g.toMenu(true);
      if (a === 'menu') return this.title();
      if (def.custom) return this.builder();
      if (last) return this.ending(g.save.flags.ending || 'savior');
      this.briefing(CAMPAIGN[idx + 1]);
    } });
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
    this.show(`<h2><small>OPERATION BUILDER</small>Write your own mission</h2>
      <p>Your story, your rules. Pick a district, write the briefing, choose what has to be done - then play it.</p>
      ${list.length ? `<h3>YOUR SAVED OPERATIONS</h3><div class="menu mlist">${list.map((m, i) => `<div style="display:flex;gap:8px"><button style="flex:1" data-a="play:${i}"><b>▶</b>${esc(m.title || 'Untitled Operation')}<small>${esc(LOCATIONS[m.location].name)} · ${THEMES[m.time].label}</small></button><button data-a="edit:${i}">Edit</button><button data-a="del:${i}">Delete</button></div>`).join('')}</div>` : ''}
      <h3>${edit ? 'EDIT OPERATION' : 'NEW OPERATION'}</h3>
      <label class="f">Operation title</label><input type="text" id="b_title" maxlength="40" placeholder="e.g. Midnight Harvest" value="${esc(f.title)}">
      <label class="f">Your story / briefing<em>shown before the mission - new line for a new paragraph. You can use {hero}, {villain}, {city} ...</em></label><textarea id="b_story" maxlength="1500" placeholder="Write what is happening and why the hero is going in...">${esc(f.story)}</textarea>
      <div class="grid2">
        <div><label class="f">Opening radio message</label><input type="text" id="b_radio" maxlength="160" placeholder="First thing your handler says" value="${esc(f.radio)}"></div>
        <div><label class="f">Enemy leader's name</label><input type="text" id="b_leader" maxlength="28" placeholder="e.g. The Jackal" value="${esc(f.leader)}"></div>
        <div><label class="f">District</label>${sel('b_loc', Object.entries(LOCATIONS).map(([k, l]) => [k, l.name]), f.location)}</div>
        <div><label class="f">Time of day</label>${sel('b_time', Object.entries(THEMES).map(([k, t]) => [k, t.label]), f.time)}</div>
        <div><label class="f">How you arrive</label>${sel('b_ins', [['foot', 'On foot'], ['car', 'By car'], ['bike', 'By motorbike'], ['parachute', 'Fly in and parachute']], f.insertion)}</div>
        <div><label class="f">How you leave</label>${sel('b_exit', [['reach', 'Reach the extraction point'], ['flyout', 'Steal a plane and fly out']], f.exit)}</div>
        <div><label class="f">Items / hostages / targets each</label>${sel('b_count', [['1', '1'], ['2', '2'], ['3', '3']], f.count)}</div>
        <div><label class="f">Enemy presence</label>${sel('b_en', [['0.6', 'Light'], ['1', 'Normal'], ['1.4', 'Heavy']], f.enemies)}</div>
      </div>
      <label class="f">What must be done<em>played in this order</em></label>
      <div class="checks">${BUILDER_OBJECTIVES.map(([k, l]) => `<label><input type="checkbox" data-o="${k}" ${f.objectives.includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <div class="row"><button class="primary" data-a="save">Save &amp; play</button><button data-a="back">Back</button></div>`,
    { on: (a) => {
      if (a === 'back') return this.title();
      const [cmd, i] = a.split(':');
      if (cmd === 'play') return this.briefing(buildCustom(list[+i]));
      if (cmd === 'edit') return this.builder({ ...list[+i], _i: +i });
      if (cmd === 'del') { list.splice(+i, 1); g.persist(); return this.builder(); }
      const form = {
        id: f.id || 'c' + Date.now(), title: this.q('#b_title').value.trim(), story: this.q('#b_story').value.trim(), radio: this.q('#b_radio').value.trim(), leader: this.q('#b_leader').value.trim(),
        location: this.q('#b_loc').value, time: this.q('#b_time').value, insertion: this.q('#b_ins').value, exit: this.q('#b_exit').value, count: +this.q('#b_count').value, enemies: +this.q('#b_en').value,
        objectives: [...this.el.querySelectorAll('input[data-o]')].filter((c) => c.checked).map((c) => c.dataset.o),
      };
      if (f._i != null) list[f._i] = form; else list.push(form);
      g.persist();
      this.briefing(buildCustom(form));
    } });
  }
}
