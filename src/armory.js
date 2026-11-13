// Profile, armory (weapons, attachments, finishes, armour, outfit), backpack and key-binding screens.
import { esc } from './util.js';
import { CAMPAIGN } from './story.js';
import { ACTIONS, keyName } from './input.js';
import {
  VARIANTS, SLOTS, SLOT_NAMES, ATTACH, FINISHES, OUTFITS, ARMORS, PACK_ITEMS, PACK_CAPS,
  weaponDef, levelOf, xpFor, rankOf, capOf, carryCount, clampCarry, defaultProfile,
} from './gear.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const stat = (label, v) => `<span class="st"><i>${label}</i>${v}</span>`;

export function armoryScreen(ui, tab = 'profile', slot = 'rifle', back) {
  const g = ui.g, prof = g.save.profile, eq = prof.equip, cast = g.save.cast;
  back = back || ui._armoryBack || (() => ui.title());
  ui._armoryBack = back;
  const again = (t = tab, s = slot) => armoryScreen(ui, t, s, back);
  const buy = (n) => { if (prof.credits < n) { g.audio.click(); return false; } prof.credits -= n; g.persist(); return true; };
  const price = (n) => (n > 0 ? `<em class="${prof.credits >= n ? '' : 'poor'}">${n} cr</em>` : '');
  const tabs = [['profile', 'Profile'], ['weapons', 'Weapons'], ['armour', 'Armour & outfit'], ['pack', 'Backpack']];
  const lvl = levelOf(prof.xp);
  let body = '';

  if (tab === 'profile') {
    const lo = xpFor(lvl), hi = xpFor(lvl + 1), pct = Math.round(((prof.xp - lo) / (hi - lo)) * 100), t = prof.totals;
    const acc = t.shots ? Math.round((t.hits / t.shots) * 100) + '%' : '—';
    const hrs = t.playSec >= 3600 ? (t.playSec / 3600).toFixed(1) + ' h' : Math.round(t.playSec / 60) + ' min';
    body = `
      <div class="row2"><div style="flex:1"><label class="f">Callsign<em>this is the hero's name in the story</em></label><input type="text" id="pf_name" maxlength="28" value="${esc(cast.hero)}"></div><button data-a="name">Save name</button></div>
      <h3>RANK</h3><p style="margin-bottom:6px"><b style="color:var(--acc);font-size:20px">${rankOf(prof.xp)}</b> &nbsp;level ${lvl}</p>
      <div class="bar" style="height:8px"><i style="width:${pct}%"></i></div><p class="note">${prof.xp} XP · ${hi - prof.xp} to level ${lvl + 1}</p>
      <h3>SERVICE RECORD</h3>
      <div class="stats">
        <div><b>${t.missions}</b><span>MISSIONS</span></div><div><b>${t.kills}</b><span>KILLS</span></div><div><b>${t.headshots}</b><span>HEADSHOTS</span></div><div><b>${t.takedowns}</b><span>TAKEDOWNS</span></div>
        <div><b>${acc}</b><span>ACCURACY</span></div><div><b>${t.deaths}</b><span>DEATHS</span></div><div><b>${t.alarms}</b><span>ALARMS</span></div><div><b>${hrs}</b><span>PLAYED</span></div>
      </div>
      <h3>BEST MISSION RANKS</h3>
      <table>${CAMPAIGN.map((m) => { const b = g.save.best[m.id]; return `<tr><td style="width:auto">${ui.T(m.title)}</td><td style="width:90px;color:${b ? 'var(--ok)' : 'var(--dim)'}">${b ? 'Rank ' + b.rank + ' · ' + b.score : 'not completed'}</td></tr>`; }).join('')}</table>
      <div class="row"><button data-a="reset">Reset profile</button></div>`;
  } else if (tab === 'weapons') {
    const eqd = weaponDef(eq[slot], prof, true);
    body = `
      <div class="tabs">${SLOTS.map((s) => `<button class="tab ${s === slot ? 'on' : ''}" data-a="slot:${s}">${SLOT_NAMES[s]}</button>`).join('')}</div>
      <p class="note">You carry one gun per slot (sidearm, primary, heavy) plus fists. Pick up a gun in the field and it swaps with the one you hold.</p>
      <h3>${SLOT_NAMES[slot].toUpperCase()} WEAPON</h3>
      <div class="grid2">${Object.entries(VARIANTS).filter(([, v]) => v.slot === slot).map(([id, v]) => {
        const own = prof.own.variants.includes(id), on = eq[slot] === id;
        return `<div class="opt ${on ? 'sel' : ''}" data-a="${own ? 'equip:' : 'buy:'}${id}"><b>${v.name} ${on ? '· EQUIPPED' : own ? '· owned' : price(v.price)}</b><span>${v.desc}</span><div class="sts">${stat('DMG', v.dmg)}${stat('RATE', (1 / v.rate).toFixed(1) + '/s')}${stat('MAG', v.mag)}${stat('NOISE', v.noise)}</div></div>`;
      }).join('')}</div>
      <h3>ATTACHMENTS</h3>
      <div class="grid2">${Object.entries(ATTACH).filter(([, a]) => a.slots.includes(slot)).map(([id, a]) => {
        const own = prof.own.att.includes(slot + ':' + id), on = eq.att[slot].includes(id);
        return `<div class="opt ${on ? 'sel' : ''}" data-a="att:${id}"><b>${a.name} ${on ? '· FITTED' : own ? '· in stock' : price(a.price)}</b><span>${a.desc}</span></div>`;
      }).join('')}</div>
      <h3>FINISH</h3>
      <div class="swrow">${FINISHES.map((f, i) => `<button class="sw ${eq.finish[slot] === i ? 'on' : ''}" style="background:${hex(f.c)}" title="${f.name}" data-a="fin:${i}"></button>`).join('')}<span class="note">${FINISHES[eq.finish[slot]].name}</span></div>
      <p class="note" style="margin-top:12px">Your ${VARIANTS[eq[slot]].name} with attachments: ${eqd.dmg.toFixed(0)} damage · ${eqd.mag} rounds · noise ${eqd.noise.toFixed(0)} · spread ${(eqd.spread * 100).toFixed(1)}</p>`;
  } else if (tab === 'armour') {
    body = `
      <h3>BODY ARMOUR</h3>
      <div class="grid2">${ARMORS.map((a, i) => {
        const own = prof.own.armor.includes(i), on = eq.armor === i;
        return `<div class="opt ${on ? 'sel' : ''}" data-a="${own ? 'armor:' : 'abuy:'}${i}"><b>${a.name} ${on ? '· EQUIPPED' : own ? '· owned' : price(a.price)}</b><span>${a.desc}</span></div>`;
      }).join('')}</div>
      <h3>OUTFIT COLOUR</h3>
      <div class="swrow">${OUTFITS.map((o, i) => `<button class="sw big ${eq.outfit === i ? 'on' : ''}" style="background:${hex(o.c)}" title="${o.name}" data-a="outfit:${i}"></button>`).join('')}<span class="note">${OUTFITS[eq.outfit].name}</span></div>
      <p class="note" style="margin-top:12px">The preview on the right shows your soldier. Armour is worn at the start of every mission; armour plates in your backpack top it up in the field.</p>`;
  } else {
    clampCarry(prof);
    const cap = capOf(prof), used = carryCount(prof.carry), nextCap = PACK_CAPS[(prof.own.pack | 0) + 1];
    body = `
      <p><b>${PACK_CAPS[prof.own.pack | 0].name}</b> · carrying <b style="color:${used >= cap ? 'var(--bad)' : 'var(--acc)'}">${used} / ${cap}</b> slots</p>
      ${nextCap ? `<div class="opt" data-a="cap" style="margin-bottom:10px"><b>Upgrade to ${nextCap.name} (${nextCap.slots} slots) ${price(nextCap.price)}</b><span>More room means more medkits, plates and decoys in a mission</span></div>` : ''}
      ${Object.entries(PACK_ITEMS).map(([k, it]) => `
        <div class="prow"><div class="pi"><b>${it.name}</b><span>${it.desc} · key ${esc(g.input.label(it.key))}</span></div>
          <div class="ctl"><button data-a="pk-:${k}">−</button><b>${prof.carry[k]}</b><button data-a="pk+:${k}">+</button></div>
          <div class="own"><span>owned ${prof.stock[k]}</span><button data-a="stock:${k}">Buy +1 ${price(it.price)}</button></div></div>`).join('')}
      <p class="note" style="margin-top:12px">What you carry is used up in missions. Medkits and plates you find on the ground are free and do not come out of your stock.</p>`;
  }

  ui.show(`
    <h2><small>${esc(cast.hero).toUpperCase()} · ${rankOf(prof.xp).toUpperCase()}</small>Profile &amp; armory</h2>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" data-a="tab:${k}">${l}</button>`).join('')}<span class="credits">CREDITS <b>${prof.credits}</b></span></div>
    ${body}
    <div class="row"><button class="primary" data-a="back">Done</button></div>`,
  { left: true, preview: true, on: (a) => {
    const [cmd, x] = a.split(':');
    if (cmd === 'back') { g.persist(); return back(); }
    if (cmd === 'tab') return again(x, slot);
    if (cmd === 'slot') return again('weapons', x);
    if (cmd === 'name') { const v = ui.q('#pf_name').value.trim(); if (v) cast.hero = v.slice(0, 28); g.persist(); return again(); }
    if (cmd === 'reset') { if (confirm('Reset your profile? Credits, gear, rank and statistics go back to the start.')) { g.save.profile = defaultProfile(); g.persist(); } return again(); }
    if (cmd === 'equip') eq[VARIANTS[x].slot] = x;
    else if (cmd === 'buy') { if (!buy(VARIANTS[x].price)) return again(); prof.own.variants.push(x); eq[VARIANTS[x].slot] = x; }
    else if (cmd === 'att') {
      const key = slot + ':' + x, list = eq.att[slot];
      if (!prof.own.att.includes(key)) { if (!buy(ATTACH[x].price)) return again(); prof.own.att.push(key); list.push(x); }
      else if (list.includes(x)) list.splice(list.indexOf(x), 1); else list.push(x);
    } else if (cmd === 'fin') eq.finish[slot] = +x;
    else if (cmd === 'armor') eq.armor = +x;
    else if (cmd === 'abuy') { if (!buy(ARMORS[+x].price)) return again(); prof.own.armor.push(+x); eq.armor = +x; }
    else if (cmd === 'outfit') eq.outfit = +x;
    else if (cmd === 'cap') { const n = PACK_CAPS[(prof.own.pack | 0) + 1]; if (n && buy(n.price)) prof.own.pack = (prof.own.pack | 0) + 1; }
    else if (cmd === 'pk+') { if (prof.carry[x] < prof.stock[x] && carryCount(prof.carry) < capOf(prof)) prof.carry[x]++; else g.audio.click(); }
    else if (cmd === 'pk-') prof.carry[x] = Math.max(0, prof.carry[x] - 1);
    else if (cmd === 'stock') { if (buy(PACK_ITEMS[x].price)) prof.stock[x]++; }
    g.persist(); again();
  } });

  // live 3D preview of the soldier holding the weapon being edited
  const shown = tab === 'weapons' ? slot : 'rifle', wd = weaponDef(eq[shown], prof, true);
  g.setPreview({ tint: OUTFITS[eq.outfit % OUTFITS.length].c, model: wd.model, finish: wd.finish, supp: wd.supp });
}

// ---------------------------------------------------------------------------- controls
export function controlsScreen(ui, back, note = '') {
  const g = ui.g, s = g.settings;
  s.keys = s.keys || {};
  if (ui._unlisten) ui._unlisten();
  const rows = ACTIONS.map(([id, label]) => `<tr><td>${esc(label)}</td><td style="width:130px"><button class="keybtn" data-a="rb:${id}">${esc(keyName(g.input.bind[id]))}</button></td></tr>`).join('');
  ui.show(`<h2><small>CONTROLS</small>Customize keys</h2>
    <p>Click an action, then press the key you want. Esc cancels. If the key is already used, the two actions swap places.</p>
    ${note ? `<p style="color:var(--acc)">${esc(note)}</p>` : ''}
    <table class="ctl">${rows}</table>
    <p class="note">Mouse: left button fires, right button aims or blocks, wheel or 1-4 change weapon. Prompts in the story text still show the default keys.</p>
    <div class="row"><button class="primary" data-a="done">Done</button><button data-a="reset">Reset to defaults</button></div>`,
  { on: (a, btn) => {
    if (a === 'done') { g.persist(); return back(); }
    if (a === 'reset') { s.keys = {}; g.input.setBindings(s.keys); g.persist(); return controlsScreen(ui, back, 'Controls reset to defaults'); }
    if (ui._unlisten) ui._unlisten();
    const id = a.slice(3);
    btn.textContent = 'press a key…'; btn.classList.add('listen');
    const onKey = (e) => {
      e.preventDefault(); e.stopPropagation();
      ui._unlisten();
      if (e.code === 'Escape') return controlsScreen(ui, back);
      const r = g.input.rebind(s.keys, id, e.code);
      if (r.error) return controlsScreen(ui, back, r.error);
      s.keys = r.map; g.input.setBindings(s.keys); g.persist();
      controlsScreen(ui, back, r.swapped ? `Swapped with “${r.swapped}”` : '');
    };
    window.addEventListener('keydown', onKey, true);
    ui._unlisten = () => { window.removeEventListener('keydown', onKey, true); ui._unlisten = null; };
  } });
}
