// Story, cast and campaign data. Every name in {braces} comes from the editable cast,
// so the player can rename anyone (or everything) from the "Cast & Story" screen.

export const GAME_TITLE = 'NIGHTFALL PROTOCOL';

export const DEFAULT_CAST = {
  hero: 'Dax Mercer',
  friend: 'Elena Cross',
  ally: 'Bishop',
  hacker: 'Juno',
  villain: 'Commander Voss',
  lt: 'Captain Strake',
  city: 'Port Meridian',
  org: 'the Grey Cordon',
  project: 'Project Nightfall',
};
export const CAST_LABELS = {
  hero: ['You (the hero)', 'Former special-forces scout turned courier and mechanic.'],
  friend: ['Your missing friend', 'Old squadmate and investigator who found the plot first.'],
  ally: ['Resistance leader', 'Runs the street network. Gives you jobs, guns and wheels.'],
  hacker: ['Hacker ally', 'Your voice on the radio. Decodes files and tracks enemies.'],
  villain: ['Main villain', 'Your former commander, now running a private army.'],
  lt: ['Enemy lieutenant', "The villain's ruthless second-in-command."],
  city: ['The city', 'Where the whole story takes place.'],
  org: ['Enemy organisation', 'The secret paramilitary group.'],
  project: ['The enemy plan', "Codename of the villain's operation."],
};

export const fill = (s, cast) => String(s).replace(/\{(\w+)\}/g, (m, k) => cast[k] ?? m);

export const INTRO = [
  "{hero} used to be a special-forces scout. One mission went wrong, people who trusted the plan did not come home, and {hero} walked away from the uniform for good.",
  "These days it is courier runs and engine grease in {city} - a coastal city squeezed between black water, dead factories and pine-covered mountains. A quiet life. Almost a normal one.",
  "Then, at 2:14 in the morning, a message arrives from {friend}, the one squadmate who never stopped checking in:\n\n\"They found me. It is real - {org}. Do not trust anyone in the department.\"",
  "By sunrise {friend}'s apartment is torn apart and {friend} is gone. Taped under a drawer is a drive with one folder on it: {project}. Power grid. Communications. City defences. Someone is planning to switch {city} off - and own it when the lights come back.",
  "The trail starts at a freight yard in the Old Harbor. The quiet life is over.",
];

const R = (who, text) => [who, text];

export const CAMPAIGN = [
  {
    id: 'm1', title: 'The Last Signal', location: 'harbor', time: 'night', insertion: 'foot', enemies: 0.9,
    place: 'Old Harbor District - freight yard',
    brief: [
      "{friend}'s drive lists a freight yard in the Old Harbor as a 'transfer point'. {org} is moving weapons and stolen hardware through it tonight.",
      "Slip inside, find the three evidence drives they keep with the cargo, then get out. There is a motor pool by the south gate - take whatever still has keys in it.",
      "This is the quiet way back into a loud world. Crouch [C] to stay hidden, take guards down from behind [F], and keep the suppressed pistol for when it goes wrong.",
    ],
    objectives: [
      { type: 'collect', count: 3, text: 'Find the evidence drives in the freight yard',
        radio: [R('{hacker}', "You don't know me yet. Call me {hacker} - {friend} told me to watch your back if she ever went dark. The yard is north of you. Stay low.")],
        done: [R('{hacker}', "That's all three. Decrypting now... {friend} is alive. They moved her out of the city.")] },
      { type: 'reach', at: 'extract', text: 'Steal a vehicle and escape along the coast road',
        radio: [R('{hacker}', 'Motor pool is by the south gate. Grab a jeep or the bike and drive west. Go!')],
        done: [R('{hacker}', "You're clear. Welcome back to the war, {hero}.")] },
    ],
    outro: ["The drives prove it: {project} is real, and {org} has people inside the police, city hall and half the private security firms in {city}.", "One name keeps coming up as the man to talk to - an old army friend who now runs a street network out of Downtown: {ally}."],
  },
  {
    id: 'm2', title: 'Broken Trust', location: 'downtown', time: 'dusk', insertion: 'car', enemies: 0.9,
    place: 'Downtown - the Pit and Aegis Security plaza',
    brief: [
      "{ally} will not meet anyone the street has not tested. His crew settles introductions two ways: fists in the Pit, and wheels on the midnight circuit.",
      "Earn the meeting. Then {ally} will point you at Aegis Security - a 'private firm' that is really {org}'s front office. Two encrypted keycards inside hold the location data {hacker} needs.",
      "No guns in the Pit. Punch with the left mouse button, block with the right, kick with [F].",
    ],
    objectives: [
      { type: 'reach', at: 'arena', text: "Drive to the Pit and meet {ally}'s crew",
        radio: [R('{ally}', "{hero}. Heard you were dead, or worse, respectable. Come to the Pit. We'll see which.")] },
      { type: 'fight', count: 4, fistsOnly: true, text: 'Win the bare-knuckle fight in the Pit',
        radio: [R('{ally}', 'Four of mine. No guns. Still standing at the end? Then we talk.')],
        done: [R('{ally}', "Ha! Still hits like a truck. One more test - my drivers don't trust anyone slow.")] },
      { type: 'race', laps: 1, rivals: 3, text: 'Win the street race in the red racer',
        radio: [R('{ally}', 'Red car on the grid is yours. Beat my three best around the block. First place or do it again.')],
        done: [R('{ally}', "Alright. You're in. Aegis Security - north-east plaza, the tall spire. That is their front door.")] },
      { type: 'collect', count: 2, item: 'keycard', text: 'Steal the encrypted keycards from Aegis plaza',
        radio: [R('{hacker}', 'Two keycards inside the walls. Guards everywhere and snipers on the towers. Your call how loud this gets.')],
        done: [R('{hacker}', 'Got them. Give me an hour and I will know where they are holding people.')] },
      { type: 'reach', at: 'extract', text: 'Get to the safehouse in the south-west',
        done: [R('{ally}', "Door's open. Sleep while you can.")] },
    ],
    outro: ["The keycards open a logistics database. {org} is holding civilians - engineers, grid operators, anyone who could switch the city back on - in the Industrial Zone.", "Their jailer has a name: {lt}."],
  },
  {
    id: 'm3', title: 'Rust and Chains', location: 'industrial', time: 'day', insertion: 'car', enemies: 1.0, loadout: ['sniper'],
    place: 'Industrial Zone - foundry fortress',
    brief: [
      "{org} turned an old foundry into a fortress. Three civilians are chained up inside, and the fuel convoys that feed {project} refuel there.",
      "Free the prisoners and bring them back to the transport west of town. Burn the three fuel convoys. And end {lt} - he never leaves a witness.",
      "{ally} left a long rifle in your trunk. Hold the right mouse button to use the scope. Tower snipers first.",
    ],
    objectives: [
      { type: 'rescue', count: 3, at: 'extract', text: 'Free the 3 captured civilians and lead them to the transport',
        radio: [R('{ally}', 'Three hostages in the sheds inside the walls. They will follow you once you cut them loose. Drive them out if you can - they fit in a jeep.')],
        done: [R('{ally}', 'My people have them. They are safe. Now make them bleed.')] },
      { type: 'destroy', count: 3, kind: 'fuel', text: 'Plant charges on the 3 fuel convoys',
        radio: [R('{hacker}', 'Convoys are parked on the marked pads. Hold [E] to plant a charge, then RUN. Six second fuse.')],
        done: [R('{hacker}', "Beautiful. That's their fuel for a month.")] },
      { type: 'kill', enemy: 'boss', name: '{lt}', text: 'Eliminate {lt}',
        radio: [R('{lt}', 'So the scout came back. {villain} said you would. He said you always arrive too late.')],
        done: [R('{hacker}', '{lt} is down. He was carrying a route map... {hero}, {friend} is in the mountains.')] },
      { type: 'reach', at: 'extract', text: 'Return to the transport',
        done: [R('{ally}', 'Get in. You look terrible.')] },
    ],
    outro: ["{lt}'s map shows a hidden base on the Mountain Road, above the snow line. {friend} is being held there.", "And it shows something else: a signature on every order. {villain} - the commander who planned the mission that ended {hero}'s career. He did not fail that day. He sold them out."],
  },
  {
    id: 'm3b', title: 'Riverline', location: 'forest', time: 'day', insertion: 'car', enemies: 1.0, loadout: ['sniper', 'rifle'],
    place: 'Greenwater Forest - jammer camp',
    brief: [
      "Nobody gets near the mountain while the jammers run. {org} hid three of them in a camp deep in Greenwater Forest, and as long as they hum {hacker} is blind and every patrol on the mountain road can hear you coming.",
      "Two rivers cut the forest. The road bridge is the obvious way across - and it is watched. The water is slow and waist deep: wade it and the trees will hide you, or take one of the boats tied up on the bank.",
      "Grab the three codebooks so {hacker} can read their traffic, blow the jammers, then get back across the river to the village.",
    ],
    objectives: [
      { type: 'collect', count: 3, text: 'Cross the river and take the 3 codebooks from the camp',
        radio: [R('{hacker}', 'Camp is north of the river. Bridge straight ahead is guarded. In the water they see you from a lot less far - your call.')],
        done: [R('{hacker}', 'Codebooks are gold. Now kill that noise.')] },
      { type: 'destroy', count: 3, kind: 'jammer', text: 'Plant charges on the 3 jammer masts',
        radio: [R('{hacker}', 'Three masts on the marked pads. Hold [E], then get clear.')],
        done: [R('{hacker}', 'Signal is clean. I can see the whole mountain road now.')] },
      { type: 'reach', at: 'extract', text: 'Get back across the river to the village',
        done: [R('{ally}', 'Nice work in the green. Next stop is uphill.')] },
    ],
    outro: ["With the jammers gone {hacker} maps every patrol between the city and the snow line. There is a gap in the sweep on the mountain road - eighty seconds wide.", "It will have to be enough."],
  },
  {
    id: 'm4', title: 'Mountain Run', location: 'mountain', time: 'dawn', insertion: 'bike', enemies: 1.0, loadout: ['sniper', 'rifle'],
    place: 'Mountain Road - ridge base',
    brief: [
      "The only way up is the mountain road, and {org} sweeps it on a timer. {ally}'s fastest bike is waiting at the village.",
      "Beat the patrol sweep around the pass, then go quiet: three signal decoders inside the ridge base will tell {hacker} how {project} is triggered. {friend} is in one of the sheds.",
      "There is an airstrip beside the base. Getting out by road is impossible - so you are going to steal their plane.",
    ],
    objectives: [
      { type: 'race', laps: 2, rivals: 0, timeTrial: 80, kind: 'bike', text: 'Ride the pass loop before the patrol sweep closes it',
        radio: [R('{ally}', 'Bike is on the grid. Two laps of the village pass in eighty seconds and their sweep misses you. Lean into it.')],
        done: [R('{ally}', "Clean. The sweep went right past. Base is north-east - on foot from here.")] },
      { type: 'collect', count: 3, item: 'decoder', text: 'Recover the 3 signal decoders from the ridge base',
        radio: [R('{hacker}', 'Three decoders. And {hero}... I checked the signature on those orders twice. {villain} was your commander. I am sorry.')],
        done: [R('{hacker}', 'Decoders are singing. {project} fires from the Aegis Spire, Downtown. Tomorrow night.')] },
      { type: 'rescue', count: 1, at: 'plane', text: 'Free {friend} and bring her to the aircraft',
        radio: [R('{hacker}', '{friend} is in one of the sheds. Get her to the airstrip on the east side.')],
        done: [R('{friend}', "Took you long enough. I knew you'd come. Can you still fly one of these?")] },
      { type: 'flyout', text: 'Steal the aircraft and fly out through the exit vector',
        radio: [R('{friend}', 'Shift for throttle, pull back with S once you pass take-off speed. North, into the cloud. Go!')],
        done: [R('{friend}', "We're clear. {hero} - {villain} is going to black out the whole city. We have one night.")] },
    ],
    outro: ["{friend} fills in the rest on the flight home. She found {project} first and tried to stop it alone. {villain} let her live only because he wanted {hero} to come.", "Tomorrow night {villain} will kill the power, cut the networks and take the city's defence satellites from the top of the Aegis Spire. There is one way in that he is not watching: the sky."],
  },
  {
    id: 'm4b', title: 'Dead Drop', location: 'forest', time: 'day', insertion: 'boat', enemies: 1.1, loadout: ['rifle', 'sniper'],
    place: 'Greenwater Forest - the river',
    brief: [
      "The parachute rig and fuel for tomorrow night's jump were coming up the Greenwater by river. They never arrived. {org} trackers hit {ally}'s couriers at the forest camp and are holding two of them.",
      "Go in by boat in broad daylight - loud is fine, fast is better. Free both couriers and bring them back down to the village.",
      "The trackers answer to a hunter they call the Warden. As long as he is breathing he will follow the trail straight back to {friend}. End it here.",
    ],
    objectives: [
      { type: 'rescue', count: 2, at: 'extract', text: 'Free the 2 couriers and get them back to the village',
        radio: [R('{ally}', 'You have the boat. Follow the river east, beach it near the camp. My people are in the sheds. They can ride with you.')],
        done: [R('{ally}', 'Both breathing. I owe you a drink and a parachute.')] },
      { type: 'kill', enemy: 'boss', name: 'The Warden', text: 'Hunt down the Warden at the camp',
        radio: [R('{hacker}', 'The Warden is at the camp office with two heavies. He will not run - he thinks he is the hunter.')],
        done: [R('{hacker}', 'Trail ends here. Nobody is following you home.')] },
      { type: 'reach', at: 'extract', text: 'Return to the village',
        done: [R('{friend}', 'Rig is packed, plane is fuelled. Get some sleep. Tomorrow night we jump.')] },
    ],
    outro: [],
  },
  {
    id: 'm5', title: 'Nightfall', location: 'downtown', time: 'blackout', insertion: 'parachute', enemies: 1.2, loadout: ['rifle', 'sniper'], decision: 'ending',
    place: 'Downtown - Aegis Spire, during the blackout',
    brief: [
      "The lights of {city} went out eleven minutes ago. {org} soldiers hold the streets and {villain} is at the Aegis Spire, waiting for the satellite uplink to finish.",
      "{friend} flies. You jump. Fly the approach, bail out over Downtown and steer your parachute into the park, then fight your way to the Spire plaza.",
      "How this night ends is your decision.",
    ],
    objectives: (flags) => {
      const fly = [
        { type: 'fly', text: 'Fly to the drop zone over Downtown',
          radio: [R('{friend}', 'Your stick, {hero}. Keep her level and follow the marker. I take over when you are out the door.')] },
        { type: 'land', text: 'Bail out [J], open your chute [SPACE] and land in the city',
          radio: [R('{friend}', 'Green light! Jump, count three, pull. See you on the other side.')],
          done: [R('{hacker}', 'Boots on the ground. The Spire is the giant tower north-east. Whole city is dark - use it.')] },
      ];
      const kill = { type: 'kill', enemy: 'boss', name: '{villain}', text: 'Confront {villain} at the Aegis Spire',
        radio: [R('{villain}', '{hero}. My best scout. I taught you everything except when to stop.')],
        done: [R('{hacker}', 'He is down. The uplink is collapsing. {hero}... it is over.')] };
      if (flags.ending === 'savior') return [...fly,
        { type: 'rescue', count: 3, at: 'lz', text: 'Free the grid engineers and escort them to the park',
          radio: [R('{hacker}', 'Three grid engineers are caged in the plaza sheds. Get them back to the park and they can restart the city.')],
          done: [R('{friend}', 'Engineers are safe. Lights first, then {villain}. Go finish it.')] }, kill];
      if (flags.ending === 'vengeance') return [...fly,
        { ...kill, timeLimit: 300, failText: '{villain} completed the uplink and vanished.', text: 'Reach {villain} before the uplink completes' },
        { type: 'reach', at: 'extract', text: 'Get out of Downtown',
          done: [R('{ally}', 'Got you. The city is burning, but it is still ours.')] }];
      return [...fly,
        { type: 'collect', count: 3, item: 'keycard', text: 'Collect the 3 broadcast keycards in the plaza',
          radio: [R('{hacker}', 'Three keycards unlock their relays. Get them and I can put every file they own on every screen in the country.')] },
        { type: 'destroy', count: 3, kind: 'uplink', text: 'Plant the uplinks on the 3 broadcast relays',
          radio: [R('{hacker}', 'Relays are on the marked pads. Hold [E] to plant an uplink. No explosions this time - just the truth.')],
          done: [R('{hacker}', "It's out. Every name. Every payment. Everyone is watching.")] },
        kill,
        { type: 'reach', at: 'extract', text: 'Leave the city before his friends find you',
          done: [R('{friend}', 'Car is running. Do not look back.')] }];
    },
    outro: [],
  },
];

export const DECISIONS = {
  ending: {
    title: 'One Night. One Choice.',
    text: ["{friend} banks the plane toward the dark shape of {city}. On the radio, {hacker} lays out three plans. There is only time for one."],
    options: [
      { key: 'savior', label: 'Save the people first', desc: 'Free the captured grid engineers before you go after {villain}. The lights come back on.' },
      { key: 'vengeance', label: 'Go straight for {villain}', desc: 'No detours. Reach him before the uplink completes - five minutes on the clock. The city pays for your speed.' },
      { key: 'truth', label: 'Expose {org}', desc: 'Steal the broadcast keycards and put every secret on every screen. Powerful people will never forgive you.' },
    ],
  },
};

export const ENDINGS = {
  savior: { title: 'SAVIOR ENDING', text: [
    "The engineers reach the substation as {villain} falls. One by one, district by district, {city} switches back on.",
    "By morning the flags of {org} are coming down and people are in the streets. Nobody knows the name {hero} - only that somebody jumped out of the sky when the lights went out.",
    "{friend} keeps the parachute. {ally} keeps the bike. And {hero}, for the first time in years, sleeps without the old mission in the dark.",
  ] },
  vengeance: { title: 'VENGEANCE ENDING', text: [
    "{villain} dies at the foot of his own tower, eleven seconds before the uplink would have finished. The debt from that old mission is finally paid.",
    "But the engineers were never freed. It takes nine days to bring the grid back, and parts of {city} burn before it does.",
    "{hero} won. Standing on the dark waterfront with {friend}, it does not feel like winning. It feels like the end of something that needed to end.",
  ] },
  truth: { title: 'TRUTH ENDING', text: [
    "Every screen in the country shows the same thing at once: names, payments, orders. {org} does not fall to bullets. It falls to daylight.",
    "Ministers resign. Arrests run for weeks. And a great many powerful people learn exactly who to blame.",
    "{hero} leaves {city} that same night on a borrowed motorbike, with a new name in one pocket and a message from {friend} in the other: \"Wherever you land - I'll find you. I always do.\"",
  ] },
};

export const APPROACHES = {
  ghost: { label: 'Ghost', desc: 'Suppressed pistol, 2 grenades. Guards spot you from 15% closer range.' },
  storm: { label: 'Storm', desc: 'Adds the AR-7 carbine, body armour and 4 grenades. Expect more guards on alert.' },
};

// ------------------------------------------------------------ custom "write your own" operations

export const BUILDER_OBJECTIVES = [
  ['fight', 'Bare-knuckle fight in the arena'],
  ['race', 'Win a street race'],
  ['collect', 'Collect intel items'],
  ['rescue', 'Rescue hostages'],
  ['destroy', 'Sabotage targets with charges'],
  ['kill', 'Eliminate the enemy leader'],
];

export function buildCustom(f) {
  const objs = [];
  const n = Math.max(1, Math.min(3, f.count | 0 || 3));
  if (f.insertion === 'parachute') objs.push({ type: 'fly', text: 'Fly to the drop zone' }, { type: 'land', text: 'Bail out [J], open your chute [SPACE] and land' });
  const has = (k) => f.objectives.includes(k);
  if (has('fight')) objs.push({ type: 'reach', at: 'arena', text: 'Go to the arena' }, { type: 'fight', count: 4, fistsOnly: true, text: 'Win the bare-knuckle fight' });
  if (has('race')) objs.push({ type: 'race', laps: 1, rivals: 3, text: 'Win the street race' });
  if (has('collect')) objs.push({ type: 'collect', count: n, text: `Collect ${n} intel item${n > 1 ? 's' : ''}` });
  if (has('rescue')) objs.push({ type: 'rescue', count: n, at: 'extract', text: `Rescue ${n} hostage${n > 1 ? 's' : ''} and lead them to extraction` });
  if (has('destroy')) objs.push({ type: 'destroy', count: n, kind: 'fuel', text: `Plant charges on ${n} target${n > 1 ? 's' : ''}` });
  if (has('kill')) objs.push({ type: 'kill', enemy: 'boss', name: f.leader || 'the enemy leader', text: `Eliminate ${f.leader || 'the enemy leader'}` });
  objs.push(f.exit === 'flyout' ? { type: 'flyout', text: 'Steal the aircraft and fly out' } : { type: 'reach', at: 'extract', text: 'Reach the extraction point' });
  if (f.radio) objs[0].radio = [['{hacker}', f.radio]];
  return {
    id: f.id || 'c' + Date.now(), custom: true, title: f.title || 'Untitled Operation', location: f.location, time: f.time, insertion: f.insertion,
    enemies: +f.enemies || 1, place: '', loadout: ['rifle', 'sniper'], brief: String(f.story || 'No briefing written.').split(/\n+/).filter(Boolean), objectives: objs, outro: [], form: f,
  };
}
