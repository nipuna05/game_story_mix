# Nightfall Protocol - App Store / mobile release plan (R&D, 2026-11-20)

Written for the project owner. Facts marked (verified) come from the sources at the bottom; facts marked (from memory) should be checked before paying for anything.

## Verdict

Feasible, but it is a project, not a switch. The game is a browser game that needs a **keyboard and mouse**. Phones have neither, so **touch controls are the real work**; wrapping it for the store is the easy part. Apple may also push back on wrapped web apps, so the store version should feel like a game and use a few native features.

## What blocks a phone release today (checked in the code)

| Blocker | Detail | Size |
|---|---|---|
| ~~No touch input~~ **Done 2026-11-20** | `src/touch.js` adds a move stick, drag-look and action buttons (foot, vehicle, aircraft). Emulated-phone checks pass; real-phone feel is untested. | Needs a real Android test |
| Menus on small screens | First pass done: bigger tap targets, no hover shift, panels scroll in landscape, 16px fields, rotate-to-landscape screen. Dense screens (armory, builder, controls) just scroll. | Small polish left |
| Performance unmeasured on phones | Only tested with a software renderer. Downtown is ~1200 draw calls; phones may need a lower quality tier (fewer shadows, lower render scale). | Medium - needs a real device |
| Asset licence | Soldier "Cole" is "royalty-free for games, do not resell the raw model". Shipping it inside an app bundle puts the raw file in every download. Check the licence text, or swap the model. | Small, but check first |
| Privacy | The leaderboard sends a callsign and score; feedback opens GitHub. A store listing needs a privacy policy URL and privacy answers. | Small |
| Age rating | Shooting and violence: expect a 12+/17+ type rating. Fill in the questionnaire honestly. | Small |

## Routes (cheapest and fastest first)

1. **Installable web app (PWA)** - add a manifest, icons and a service worker; players use "Add to Home Screen". Free, no review, works on iPhone and Android. Still needs touch controls. Good first milestone and a safe fallback.
2. **itch.io HTML5 upload** - free store-like page with a built-in audience; no wrapper. Works for desktop; mobile browsers on itch are limited.
3. **Android (Google Play) via Capacitor or a trusted web activity** - cheaper and faster than Apple. Personal accounts created after 13 Nov 2023 must run a closed test with at least 12 testers opted in for 14 days before production (verified). The one-time registration fee is about 25 USD (from memory - not confirmed in my search).
4. **iOS App Store via Capacitor** - needs the Apple Developer Program, 99 USD per year (verified; individuals use their legal name as seller name). Builds need Xcode/a Mac; cloud build services (for example Capgo or Capawesome) can build and sign without owning a Mac, but the final review submission is done in App Store Connect (verified, vendor pages). Enrolment is usually quick but some people report weeks of delay in 2026 (verified, forum reports).
5. **Steam via Electron or Tauri** - controls already fit (keyboard and mouse). Steam charges a one-time fee per game (about 100 USD, from memory). No touch work; a good option if desktop is the real audience.

## Apple review risk (Guideline 4.2, minimum functionality)

- Apple rejects apps that are just a website in a wrapper; the test reviewers use is whether the app gives something you could not get by opening the site in Safari (verified, guide and forum reports).
- A **game that runs offline with its own content, controls and progression** is much safer than a content or booking wrapper, but there is no guarantee. Reports show reviewers sometimes ask for more native features (verified, forum reports).
- Cheap native additions that help: haptics on shooting and damage, Game Center (instead of or next to the Supabase leaderboard), local notifications for the daily challenge, full offline play (all assets bundled), iPad layout.
- Apple does not distribute plain web apps through the store; the web version stays on your own site (verified, forum reports).

## Phased plan

1. **Decide the target** (see questions below).
2. **Touch controls** (the big one): left stick move, right-side drag to look, buttons for fire, aim, jump, crouch, reload, use, weapon switch, grenade, backpack items; vehicle and aircraft layouts; auto-detect touch devices and hide the key hints. Keep keyboard, mouse and gamepad working.
3. **Mobile UI pass**: bigger buttons, scrolling menus, text fields that do not hide behind the keyboard.
4. **Performance pass on a real phone**: add a "mobile" quality preset (render scale, shadows, draw distance, fewer instances); target steady 30 fps on a mid-range phone.
5. **PWA release** (manifest, icons, offline cache). Ship this to real users and collect feedback.
6. **Wrap with Capacitor** (Android first if you want a cheap trial): bundle assets locally, add haptics, Game Center / Play Games, notifications.
7. **Store paperwork**: privacy policy page, age rating answers, screenshots and a short trailer (the demo GIF is a start), app icon, description, support URL.
8. **TestFlight / closed testing**, then submit. Expect at least one review round.

## Rough effort (my estimate, for planning only)

Touch controls plus mobile UI: the largest block (several focused sessions). PWA: small. Capacitor wrap and native extras: medium. Store paperwork: small but fiddly. The unknown is phone performance.

## Questions that decide the route

- Do you own a Mac, or are you happy to use a paid cloud build service?
- Do you have iPhone and Android phones to test on (real-device testing is essential)?
- Which matters first: iPhone, Android, or desktop (Steam/itch)?
- Budget: Apple 99 USD per year; Google about 25 USD once; optional cloud build fees.

## Recommendation

Do steps 2-5 first (touch controls, mobile UI, performance, PWA). They help every player now, cost nothing, and de-risk every store route. Then try **Android** as the cheap store test, and go to **iOS** once the game runs well on a phone.

## Sources

- Apple developer forum threads on Guideline 4.2 rejections, and the MobiLoud wrapper guide: https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper
- Apple Developer Program enrolment and fee: https://developer.apple.com/programs/enroll/ and https://developer.apple.com/support/enrollment/
- Cloud iOS builds without a Mac: https://capawesome.io/solutions/build-without-mac/ and https://capgo.app/blog/capacitor-ios-development-without-mac-faq/
- Google Play closed testing requirement: https://support.google.com/googleplay/android-developer/answer/14151465
