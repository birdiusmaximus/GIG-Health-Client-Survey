# GIG Health — 3D Animated Survey Site (Handover)

This document is the full context for a new Claude Code session opened in this folder. Read it end-to-end before doing anything else.

---

## 1. What we're building

A scroll-driven, interactive 3D website that hosts GIG Health's **client feedback survey**. The animation is the hook to draw people in; the job is collecting honest answers from clients.

- **Format**: One scene per question. The user scrolls; a "ball" travels Rube-Goldberg-style between scenes.
- **Audience**: GIG Health clients (pharma, healthcare comms) who have just finished a project with GIG.
- **Brand**: This is for **GIG Health** (`gig.health`), a healthcare creative agency. Do **not** confuse with GRIDIRONS (a separate, unrelated brand the user owns — heat-branding tool for footballs, lives at `~/Documents/GridIrons/Website/`, do not touch).

---

## 2. Links shared by the user

| Purpose | URL |
|---|---|
| Original 3D animation style reference (Pinterest) | https://uk.pinterest.com/pin/22869910604731425/ |
| Survey questions (live SurveyMonkey form) | https://uk.surveymonkey.com/r/7XZBBWP |
| GIG Health website (visual identity reference) | https://gig.health |
| Adobe Typekit kit (motiva-sans) | https://use.typekit.net/wek0eum.css |

The user also shared a screen recording of the Pinterest animation. It was in a sandboxed macOS temp folder (`/var/folders/.../TemporaryItems/...`) that Claude Code can't read. If you need to look at it, ask the user to drop a copy into this project folder.

**User's verbal description of the reference animation**: *"Rube Goldberg style ball animation, going through various dynamic obstacles, with scroll navigation to move between scenes."*

---

## 3. The survey — verbatim, in order

10 questions. Q1–Q8 required, Q9–Q10 optional.

| # | Question | Type | Options |
|---|---|---|---|
| 1 | What was the name of this project? | Open text | — |
| 2 | How would you rate the final deliverable(s)? | Single choice | An excellent standard / A high standard / Fair / Not everything we'd hoped for / Disappointing |
| 3 | How creative was the final product? | Single choice | Ground breaking / Really creative and engaging / Quite creative, fit for purpose / Average, not very original / Lacking thought and creativity |
| 4 | How competitive was our cost/budget? (compared to others) | Single choice | Higher than others / On par with others / Cheaper than others / N.A. (Budget was predetermined) |
| 5 | Please describe your experience working with GIG. How have you benefited from our work? | Open text | — |
| 6 | Would you be happy for us to use your above response on our online channels? | Single choice | Yes / No |
| 7 | What could we do better, to ensure we work together again? | Open text | — |
| 8 | Could we use the output(s) of this project in our case studies / marketing materials with citation? | Single choice | Yes (as it is) / Yes, with adaptation (e.g. remove client/product name, abridged, etc) / Possibly (need to check) / No |
| 9 | We loved working with you and would be delighted to work with likeminded clients like you. Is there anyone you know who could benefit from our help? Please share their name and email address below. | Open text (optional) | — |
| 10 | As things continue to evolve in healthcare communications, are there any trends or challenges you'd like to better understand or get ahead of? | Open text (optional) | — |

---

## 4. GIG visual identity (extracted from gig.health source)

### Colours
| Role | Hex | Notes |
|---|---|---|
| Primary | `#F45347` | Coral/red — site theme-color, the dominant brand colour |
| Accent green | `#68ad91` | Used in Safari pinned-tab + recurring CSS |
| Accent yellow | `#FFBF3F` | |
| Accent lavender | `#D3A8F4` | |
| Soft background | `#FEF6F6` | Blush off-white |
| Deep navy | `#0d1a2d` | Text / dark surfaces |
| Pure white | `#FFFFFF` | |
| Pure black | `#000000` | |

### Typography
- **Font family**: `motiva-sans` (Adobe Fonts / Typekit)
- **Embed**: `<link rel="stylesheet" href="https://use.typekit.net/wek0eum.css">`
- **Weights available in this kit**: 4 faces — regular + bold, with italics
- CSS: `font-family: "motiva-sans", sans-serif;`

### Mood
Bright, playful, healthcare-creative. Not clinical. Strong typography, generous whitespace, confident colour. Opposite of corporate-pharma sterile.

---

## 5. Decisions already made

| Decision | Choice | Notes |
|---|---|---|
| Tech stack | **Three.js + GSAP ScrollTrigger** | ES modules from CDN initially — no build step until we need one |
| 3D approach | **Real-time, code-generated** | Not pre-rendered video. Survey needs interactivity. |
| 3D assets | **Primitives only** for v1 | Boxes, spheres, ramps with nice materials/lighting. Upgrade to authored `.glb` models later. |
| Pacing | **One scene = one question** | 10 scenes total |
| Animation | **Pre-keyframed**, not real physics | Every visitor sees the same choreographed sequence. Use GSAP timelines, not a physics engine. |
| Hosting | **Vercel** | |
| Backend | **Vercel serverless function** (`api/submit.js`) | Receives POST with all 10 answers |
| Backend long-term destination | **Not yet decided** | Options: Google Sheets via Apps Script webhook, Airtable, Notion DB, email via Resend, or Vercel KV/Postgres. **Ask user before wiring.** |
| Project location | `~/Documents/GIG/survey-3d/` | This folder. Kebab-case, no spaces. |

---

## 6. Proposed scene plan (NOT YET APPROVED — confirm with user)

Each scene is one question. The ball arrives, the question UI fades in, user answers, ball departs and triggers the next scene.

| Scene | Question | Visual concept |
|---|---|---|
| 1 | Project name | Ball drops in; "types" project name onto a wall plaque as the user types |
| 2 | Deliverable rating | Ball rolls onto a 5-rung ladder; chosen rung lights up |
| 3 | Creativity rating | Ball passes through a prism, splits into 5 coloured beams; pick one |
| 4 | Budget competitiveness | Ball weighed on a balance scale against budget tiles |
| 5 | Experience (open) | Ball paints a coloured trail on a canvas; text appears as if written by the ball |
| 6 | Permission to quote | Ball at a fork: green check / red X gates |
| 7 | What could we do better (open) | Ball threads through a gear/maze; text input as it moves |
| 8 | Marketing usage rights | Ball into a film projector; pick usage option as a film reel |
| 9 | Referral (optional) | Ball rolls into an envelope that addresses itself |
| 10 | Trends/challenges (optional) | Ball lands in a final pad; confetti burst on submit |

**Open question for the user**: do they want this exact scene-by-scene plan, a different metaphor per scene, or a more unified/abstract style? Worth confirming before building.

---

## 7. Suggested file structure

```
survey-3d/
├── HANDOVER.md          # this file
├── index.html           # markup, font link, Three.js canvas, survey overlay UI
├── styles.css           # GIG palette as CSS variables, motiva-sans, layout
├── main.js              # Three.js scene setup, scroll choreography, state
├── scenes/              # one module per scene (split out once main.js gets large)
│   ├── scene1-name.js
│   ├── scene2-rating.js
│   └── ...
├── api/
│   └── submit.js        # Vercel serverless function — POST /api/submit
├── package.json
├── vercel.json
└── .gitignore
```

Don't pre-create the `scenes/` split — start in `main.js` and refactor when it's actually needed.

---

## 8. Vercel deployment

The user wants Vercel hosting. Setup:

1. `npm i -g vercel` (if they don't have it — check first)
2. From this folder: `vercel` (first run links the project)
3. `vercel deploy --prod` ships it
4. Serverless functions live in `/api/` automatically

The user must run `vercel` themselves the first time — it requires browser auth. Prep everything else (vercel.json, package.json, api/ folder) so it's ready to go.

---

## 9. Open questions to resolve before / during build

1. **Sign off on scene-by-scene plan** (Section 6 above) — or redesign?
2. **Where do answers ultimately go?** Sheets / Airtable / email / DB?
3. **Domain** — Vercel default (`survey-3d.vercel.app`) or custom (`survey.gig.health`)?
4. **Mobile**: Three.js performance on low-end mobile is a real constraint. Worth confirming the user's expectation — do we degrade to a 2D/static version on small screens, or push for a unified experience?
5. **Analytics / completion tracking** — anything beyond the form submission itself?
6. **Privacy / GDPR** — survey collects names, emails (Q9), opinions. Need a privacy notice.
7. **Authentication** — is the survey link sent privately to clients (no auth), or does it need a unique token per client?

---

## 10. Suggested first task for the new session

1. Read this file in full.
2. Confirm Section 6 scene plan with the user.
3. Once confirmed, scaffold `index.html`, `styles.css`, `main.js`, `package.json`, `vercel.json`, `.gitignore`. Use the Typekit link, the GIG palette as CSS variables, and a working Three.js canvas with a single placeholder sphere that scrolls. Get **scene 1 only** working end-to-end (3D + question UI + state + "next" trigger), then loop with the user before building scenes 2–10.
4. Wire `api/submit.js` as a stub that logs to console and returns `{ ok: true }`. We'll point it at a real destination once Section 9 Q2 is answered.

Build small, show the user, iterate. Don't build all 10 scenes before they've seen scene 1 in their browser.

---

## 11. Reference — what already exists

- Nothing in this folder yet.
- The user previously showed a related project (GRIDIRONS) at `~/Documents/GridIrons/Website/` — different brand, **do not modify or import from it**. It's only useful as evidence the user is comfortable with HTML/CSS/JS landing pages and good design.
