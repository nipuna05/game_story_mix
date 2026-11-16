# Nightfall Protocol

A 3D story-driven stealth/action game that runs in the browser. One campaign mixes every play style:
sneaking, shooting, bare-knuckle fighting, street racing, motorbike riding, flying a plane and
parachuting into a blacked-out city.

Built with [three.js](https://threejs.org/) and Vite. Soldiers, weapons and the motorbike use 3D models in
`public/models` (credits below); everything else is generated in code and all sound is synthesised.
If a model file is missing the game falls back to built-in shapes.

## Run it

```bash
npm install
npm run dev
```

Open the address Vite prints (normally http://localhost:5173). Click the game once to capture the mouse.

`npm run build` produces a static site in `dist/` that can be hosted anywhere.

## The story

You are a former special-forces scout who walked away after a mission went wrong, and now live quietly as a
courier and mechanic in a coastal city. One night your closest friend sends a last message - *"They found me.
It is real. Do not trust anyone in the department."* - and vanishes. A hidden drive in her wrecked apartment
points to a secret paramilitary group that plans to switch off the city's power, communications and defences
and take control when the lights come back.

**Every name is yours to change.** The hero, the missing friend, the allies, the villain, the city, the enemy
organisation and its plan are all editable from **Cast & names** on the main menu. Briefings, radio chatter
and endings use whatever you type.

| # | Mission | District | What you do |
|---|---------|----------|-------------|
| 1 | The Last Signal | Old Harbor, night | Sneak into a freight yard, collect evidence drives, steal a jeep or bike and escape |
| 2 | Broken Trust | Downtown, dusk | Win a bare-knuckle fight, win a street race, steal keycards from a guarded plaza |
| 2b | Dead Air | Downtown, night | A ghost job: copy relay codes and plant charges on two masts - raise the alarm and you fail |
| 3 | Rust and Chains | Industrial Zone, day | Free three hostages, blow up fuel convoys, eliminate the enemy lieutenant |
| 3b | Riverline | Greenwater Forest, day | Cross two rivers (wade, boat or bridge), steal codebooks, blow up jammer masts |
| 4 | Mountain Run | Mountain Road, dawn | Motorbike time trial, recover decoders, rescue your friend, steal a plane and fly out |
| 4b | Dead Drop | Greenwater Forest, day | Arrive by boat, rescue couriers, hunt the Warden |
| 5 | Nightfall | Downtown, blackout | Fly in, parachute into the dark city and face the commander |

Before the final mission you choose how the night goes, which changes the objectives and the ending:

- **Savior** - free the captured engineers first, then confront the commander.
- **Vengeance** - go straight for him against a five-minute clock.
- **Truth** - steal broadcast keycards and expose the whole organisation.

Before every mission you also pick an approach: **Ghost** (suppressed pistol, harder to spot) or **Storm**
(carbine, body armour, more grenades, more guards).

## Write your own story

**Operation builder** on the main menu lets you create missions: give it a title, write the briefing, pick
the district, time of day, how you arrive (on foot, car, motorbike, or fly in and parachute), how you leave
(extraction point or steal a plane), and tick which objectives it contains - fight, race, collect, rescue,
sabotage, eliminate. Your operations are saved in the browser and can be edited or replayed.

## Controls

| On foot | |
|---|---|
| W A S D / mouse | Move / look |
| Shift | Sprint (noisy) |
| C | Crouch - quieter and harder to see |
| Space | Jump |
| Left mouse | Fire / punch |
| Right mouse | Aim, sniper scope, block when using fists |
| R | Reload |
| 1 2 3 4 or wheel | Fists, pistol, rifle, sniper |
| F | Kick - a silent takedown when used from behind |
| G | Throw grenade |
| E | Enter vehicle; hold to free hostages or plant charges |

| Car and motorbike | |
|---|---|
| W / S | Accelerate / brake and reverse |
| A / D | Steer |
| Space | Handbrake |
| E | Get out |

| Aircraft | |
|---|---|
| Shift / C | Throttle up / down |
| S / W | Pull up / push down |
| A / D | Bank left / right |
| J | Bail out |
| E | Get out when stopped on the ground |

| Parachute | |
|---|---|
| Space | Open the canopy |
| Mouse or A / D | Steer |
| W / S | Dive / flare |

Tab toggles the objective list, H opens the field manual, Esc pauses.

## Profile, armory and backpack

Open **Profile & armory** from the main menu (or **Loadout & backpack** on any mission briefing).

- **Profile:** your callsign (the hero's name), rank and level, service record and best mission ranks. Missions pay credits and XP.
- **Weapons:** you carry one gun per slot - sidearm, primary and heavy - plus fists and a kick. Buy better guns (G-17, D-50 Magnum, AK-47, MP5, P90, SPAS-12 and Striker shotguns), fit attachments (suppressor, extended magazine, stabiliser grip, optic) and pick a finish colour. A live 3D preview shows your soldier with the gun.
- **Armour & outfit:** body armour tiers worn at the start of every mission, and an outfit colour for the soldier.
- **Backpack:** medkits, armour plates, noisemakers, ammo boxes and grenades. Capacity is limited and can be upgraded. Use them in the field with Q, X, T and Y.

In the field, **enemies drop their guns**. Press the use key next to a gun to take it - it swaps with the gun you carry in that slot, and yours is dropped. U drops the gun you hold. Weapon racks with guns, ammo and medkits are hidden in compounds and in some buildings. Medkits and plates you find are free; the ones from your own stock are only used up when you use them.

## Villages

The forest and mountain villages are built from the Medieval Village kit: textured plaster and stone cottages with tiled roofs, doors, windows and furnished interiors you can walk into.

## Vehicles, passengers and races

Cars, the jeep and the boat are detailed models built in code (curved bodies, glass over a visible interior, spinning wheels, lights). Your driver is visible at the wheel. Rescued hostages board when you drive up and sit in the free seats (sedan 3 passengers, jeep 3, sports car 1, boat 3, motorbike 1 on the back) and step out beside you when you get out or reach the safe zone.

During a race a **route map** shows the whole track with numbered checkpoints, your position and the rivals, and glowing arrows are laid along the road to the next checkpoints.

## Tips, enemies and gamepad

- **Tips:** short one-time hints appear for new players (crouching, suspicious guards, the alarm, medkits, driving, flying, hostages). Story and hint text shows whatever keys you have bound. Turn them off, or show them all again, in Settings.
- **Enemy tactics:** after a few bursts or when hit, guards dive behind cover and shoot from there. Heavies and the boss throw grenades; a GRENADE! warning appears, so move.
- **Gamepad:** plug one in and press a button. Sticks move and look, RT fires, LT aims, A jumps, B crouches, X reloads, Y uses, LB grenade, RB next weapon, d-pad items, Start pauses. Menus need the mouse.

## Vegetation and cover

Trees, bushes, grass and rocks are drawn with leaf, needle, bark and stone textures made in code (no image files): leafy broadleaf trees, spruces with needle branches, palms, dense bushes, grass tufts and noise-shaped boulders. Bushes hide you when you crouch or crawl in them.

Every map is checked for open gaps: if a spot is more than about 17 m from cover, a hiding cluster is placed there (groves, boulders, hedges, low walls, crate piles, wrecked cars, logs, drum stacks). Cover also ring-fences each enemy compound so you can creep up on it. On the five maps the farthest point from cover is now 37 to 52 m (it was 75 to 126 m), and 94 to 99% of the ground is within 25 m of cover.

## Graphics quality

Settings -> Graphics has three levels: **High** (sharp shadows, glow, reflections), **Medium** (smaller shadows, lower resolution) and **Low** (no shadows or glow, fastest). Streets have parked cars (the same detailed models, drawn cheaply), benches, bins, hydrants and bus stops.

## Enemies you can tell apart

Guards wear a red beret, heavies carry a pack and a chest rig and are bigger, snipers wear a bush hat, street fighters wear caps, and the boss wears a black beret and a pack. Buildings have air-conditioners, rooftop tanks, awnings with glowing signs, fire escapes, pipes and loading doors, and the streets have zebra crossings.

## Aiming and spotting

Aiming zooms in (pistols 52 degrees, rifles 40, optics and scopes more). Enemies near the crosshair in line of sight get a tag with their type and distance for a few seconds, and show on the minimap.

## Menus

Every menu screen is split into sub-tabs (briefing, settings, manual, controls, operation builder, cast, profile and weapons) so nothing needs scrolling at 1280 x 720.

## Sound and music

- **Guns:** each weapon has its own layered sound (crack, blast, thump and an echo tail), louder and sharper up close, duller and echoing far away, panned to where the shot came from. Shotguns pump and the sniper rifle works its bolt. Reloads, empty clicks, weapon swaps, footsteps, bullet impacts and hits have their own sounds.
- **Vehicles:** the cars and the motorbike use real engine recordings that rise and fall with speed; tyres skid on sharp turns and crashes have an impact sound.
- **Music:** a splash screen (click or press a key, which browsers require before any sound) starts the music on the home screen. A tense military score is generated live. It is calm in menus, a driving pulse during play, and turns intense when guards are alerted, an alarm sounds or you race. Volume sliders for music and effects are in Settings; **M** mutes everything.
- **Real gun recordings (optional):** put a short single-shot `.ogg` in `public/sounds/guns/` named after the weapon (`usp ak47 m4a1 mp5 p90 spas12 striker deagle glock l118a`, e.g. `ak47.ogg`) and the game uses it instead of the generated shot. Only add recordings you are allowed to ship.

## Stealth movement and cover

Crouch (C) for slow quiet walking, hold V to sneak while standing, or crawl prone (Z) to be quietest and hardest to see. Bushes hide you - crouch or crawl inside one and guards see you from much less far. Some buildings can be entered through a door; their walls block line of sight and you can shoot out of the windows.

## Controls

Every key can be changed: **Settings -> Customize controls**. Click an action, press the new key. If the key is already used the two actions swap. Press **K** in game to see the key list, **H** for the full manual, **B** to change brightness.

## How stealth works

- The diamond above an enemy shows what they know: yellow is suspicious, red means they have seen you.
- Guards see less far at night and when you crouch. Tower snipers see much further.
- The suppressed pistol is only heard a few metres away; the rifle and sniper carry across a compound.
- If a guard stays alerted for a few seconds the alarm is raised and nearby guards converge on you.
  Finishing a mission with no alarm earns the ghost bonus.
- After dying you can continue from the last completed objective; enemies you killed stay dead.

## Project layout

```
index.html          page shell and HUD markup
src/main.js         game loop, spawning, combat helpers, mission flow
src/carmodels.js   detailed cars, jeep and boat built in code
src/world.js        scene, lighting themes, collision, ray casting, navigation graph
src/gear.js         weapons, attachments, armour, backpack items and the profile data
src/armory.js       profile / armory / backpack and key-binding screens
src/input.js        keyboard and mouse with rebindable keys
src/locations.js    the four districts (town grids, walled compounds, airstrips)
src/player.js       on-foot, parachute and vehicle control, weapons, camera
src/enemies.js      guard / sniper / thug / boss AI and hostages
src/vehicles.js     cars, motorbike, aircraft and racing AI
src/mission.js      objective logic (collect, rescue, sabotage, race, fly ...)
src/story.js        cast, campaign, decisions, endings, operation builder
src/audio.js        sound effects and engine loops        src/music.js  generated background music
src/hud.js          HUD and minimap        src/ui.js   menus and screens
src/fx.js           tracers and explosions src/audio.js synthesised sound
tools/smoke.mjs     headless test that plays through every mission
```

To run the automated test, start `npm run dev` and then run `node tools/smoke.mjs` (uses the installed
Edge or Chrome).

## Credits

- Soldier Cole - Grigory Petrov - royalty-free for games, do not resell the raw model.
- Guns (USP, Glock, M4A1, AK-47, L118A) - models supplied by the project owner, who confirmed usage rights.
- Military motorbike - Zsky (Poly Pizza).
- Medieval Village MegaKit (cottage walls, roofs, crates, wagon) - Quaternius - CC0.
- Engine, skid and impact sounds - Kenney (CC0); skid sound by Landeplage (CC0).
