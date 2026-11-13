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
src/world.js        scene, lighting themes, collision, ray casting, navigation graph
src/locations.js    the four districts (town grids, walled compounds, airstrips)
src/player.js       on-foot, parachute and vehicle control, weapons, camera
src/enemies.js      guard / sniper / thug / boss AI and hostages
src/vehicles.js     cars, motorbike, aircraft and racing AI
src/mission.js      objective logic (collect, rescue, sabotage, race, fly ...)
src/story.js        cast, campaign, decisions, endings, operation builder
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
