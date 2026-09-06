# PC Tier List: method and build guide

This document describes how the #THE-STANCE tier list (https://github.com/RaizerLeaf/the-stance-tier-list) is built and scored, so a fresh Claude session can produce a second list for a different group of people that ranks the same way. Hand this file to that session together with a list of the new group's builds.

The fastest route is to copy `index.html` from the repo above as the template and replace the `SYSTEMS` array. Everything below explains what is in that file and which rules to follow when filling it in.

---

## 1. Hosting and repo layout

- One static page, `index.html`, with all CSS and JavaScript inline. No build step, no framework, no external assets except Google Fonts.
- Hosted with GitHub Pages from the root of the `main` branch. Push to `main` and the page updates within a minute.
- `server.js` plus `package.json` (Express) exist only for `npm run dev` local preview. GitHub Pages ignores them.
- Keep the line endings consistent with the file you copy (the original is CRLF). Any script that slices `index.html` by line should normalise `\r\n` to `\n` first; the ladder check in section 9 does this.

---

## 2. Page structure, top to bottom

1. **Comparison banner** (hidden until comparison mode is active).
2. **Header**: title `#THE-STANCE TIER LIST` and subtitle "1080p/1440p Bottleneck Adjusted Rankings — Click rows for system breakdowns". Change the title for the new group.
3. **Legend** ("How to read this list"): four short cards (Score, Tier, Rank, Rows) and a `<details>` block with the full formula text, tier band explanation, and a Specs & VRAM note. Footer line: "Data last reviewed <date> · fps figures describe rendered frame rate, not display refresh rate."
4. **Tier ladder** (`<div id="tier-list-root">`): rendered entirely by JavaScript from `SYSTEMS`. One section per tier that has at least one entry. Each section is a table with columns Rank, Name, Specs, VRAM, Score.
5. **GPU database section**: two tabs. "Relative Power Lookup" (searchable list rendered from `GPU_DATABASE`, vendor filter) and "DLSS vs FSR vs XeSS" (static three-column feature breakdown: for each feature the version that introduced it, a plain-language description, and the card series that can run it, followed by an at-a-glance table and a closing `.fx-callout` paragraph). Everything in that tab is list-independent except the callout, which names the cards and machines on the list and must be rewritten for the new group.
6. **Comparison modal**: opened by the "Upgrade Comparison" button inside a row, then clicking a second row. Shows both names and scores and a generated narrative about what the lower build needs to reach the higher one.

Rows are click-to-expand. The expanded panel shows: Profile, Targeted Gameplay, Score Breakdown (the multiplied terms, plus an optional rating note), and an Upgrade Path card (Downside, Upgrade, and the comparison button).

Tier colours (CSS variables): S `#f59e0b`, A `#a855f7`, B `#3b82f6`, C `#10b981`, D `#ec4899`, E `#f43f5e`, F `#ef4444`. Dark theme throughout.

---

## 3. The data model: one object per build

Every row is an object in the `SYSTEMS` array. Scores are never typed by hand; they are computed from these fields.

```js
{
    id: "jc", name: "JC", deviceClass: "desktop",
    cpu: "Ryzen 7 5700X3D", cpuIndex: 76, cpuTier: 4,
    gpu: "RTX 5080", gpuRef: "RTX 5080", upscaler: "mfg",
    vram: 16, memory: 32, memoryType: "DDR4", unified: false, platform: "am4-x3d",
    added: "2026-09-05",              // optional
    updated: "2026-09-03",            // optional
    ratingNote: "...",                // optional
    profile: "One or two sentences on what the build is.",
    target: "1440p Ultra · 165+ fps / 4K High · 90+ fps",
    downside: "What holds it back.",
    upgrade: "The sensible next step, written for today's prices."
}
```

| Field | Meaning |
|---|---|
| `id` | Stable slug. Used for row ids and the comparison engine. |
| `name` | Display name (person or device). |
| `deviceClass` | `desktop`, `console`, `handheld`, or `prebuilt`. Non-desktop classes get a badge next to the name. |
| `cpu` | Display string. |
| `cpuIndex` | CPU gaming index, 0 to 100. Ryzen 9 9950X3D and 9800X3D are 100. From published 1080p gaming averages. See the table in section 6. |
| `cpuTier` | 0 (locked or legacy) to 6 (flagship X3D). Only used by the comparison engine's upgrade wording. |
| `gpu` | Display string. For consoles and handhelds: architecture plus closest desktop equivalent, e.g. `RDNA 2 36 CU (~ RTX 2070 Super)`. |
| `gpuRef` | The part fed to the GPU lookup. For fixed hardware add the suffix ` Custom` (e.g. `RTX 2070 Super Custom`); the lookup strips it and the word marks the GPU as shared or unified. |
| `upscaler` | `mfg` (DLSS 4 Multi Frame Gen, RTX 50), `fg` (DLSS Frame Gen, RTX 40), `ml` (machine-learned upscaling: RTX 20/30, RX 7000 via FSR 4.1, RX 9000, PSSR, XeSS on Intel Arc, Switch 2 DLSS), `fsr` (shader upscaling only: RDNA 2 and older Radeons with RT), `none` (no ML upscaling and no hardware RT: Pascal, GCN, Maxwell). Intel Arc has XeSS 3 multi-frame generation but stays `ml`; see section 7. |
| `vram` | Dedicated graphics memory in GB. For unified systems, the size of the shared pool. |
| `memory`, `memoryType` | System RAM in GB and type, e.g. `DDR4`, `GDDR6`, `LPDDR5X`. |
| `unified` | `true` when CPU and GPU share one memory pool (consoles, handhelds). |
| `platform` | `am5`, `am5-x3d`, `am4`, `am4-x3d`, `am4-3000` (Ryzen 2000/3000 on AM4, X3D drop-in after a BIOS flash), `intel-9th`, `legacy-intel`, `intel-1700` (LGA1700 12th to 14th gen, dead socket, 14th gen drop-in only), `console`, `handheld`, `prebuilt`. Drives the platform multiplier and the comparison engine's advice. |
| `legacy` | `true` when the platform no longer receives current releases (PS4, Xbox One, Switch 1). |
| `added` | ISO date the entry joined the list. Shows a "New" badge beside the name for 60 days, then hides itself. Both badges can show at once. |
| `updated` | ISO date of the last hardware change. Shows an "Updated" badge beside the name for 60 days, then hides itself. |
| `ratingNote` | Optional sentence under the breakdown explaining a rating that differs from the hardware on paper. |
| `target` | Format: `<res> <preset or upscaler> · <fps>[ / second target][ (catalogue note)]`. |

---

## 4. The scoring formula

```
P     = GPU% × features × VRAM × (cpuIndex / 100)^0.5 × platform × RAM × legacy
P_rel = min(1, P / reference)          reference = 100 × 1.04 × 1.02 = 106.08
Score = round( 100 × (1 − (1 − P_rel)^2.8) )
```

The reference is an RTX 5090 (100%) with a 9950X3D (100) on AM5, which scores exactly 100. The curve flattens toward the top so flagships stay hard to separate and S stays hard to reach, and is near-linear through the console and mid-range zone.

### Terms and constants

| Term | Value |
|---|---|
| GPU% | TechPowerUp relative performance, RTX 5090 = 100. Looked up from `gpuRef`. |
| features | `mfg` 1.04 · `fg` 1.02 · `ml` 1.00 · `fsr` 0.98 · `none` 0.92 |
| VRAM | `1 − 0.025 × max(0, 12 − effectiveVram)`. Effective VRAM is `vram`, or `vram × 0.75` when `unified` is true. |
| CPU | `sqrt(cpuIndex / 100)` |
| platform | `am5` 1.02 · `am5-x3d` 1.02 · `intel-9th` 0.99 · `legacy-intel` 0.99 · `intel-1700` 0.99 · everything else 1.00 |
| RAM | 0.97 for a non-unified system with less than 32 GB, else 1.00 |
| legacy | 0.80 when `legacy` is true, else 1.00 |

### The code, verbatim

```js
const SCORING = {
    reference: 100 * 1.04 * 1.02,
    cpuWeight: 0.5,
    vramTarget: 12,
    vramPenaltyPerGb: 0.025,
    unifiedShare: 0.75,
    ramPenalty: 0.97,
    legacyPenalty: 0.80,
    curve: 2.8,
    upscaler: { mfg: 1.04, fg: 1.02, ml: 1.00, fsr: 0.98, none: 0.92 },
    platform: { 'am5': 1.02, 'am5-x3d': 1.02, 'intel-9th': 0.99, 'legacy-intel': 0.99, 'intel-1700': 0.99 }
};

function scoreSystem(s) {
    const gpu = getGpuPerf(s.gpuRef);
    const features = SCORING.upscaler[s.upscaler] !== undefined ? SCORING.upscaler[s.upscaler] : 1;
    const vramEff = s.unified ? s.vram * SCORING.unifiedShare : s.vram;
    const vram = 1 - SCORING.vramPenaltyPerGb * Math.max(0, SCORING.vramTarget - vramEff);
    const cpu = Math.pow(s.cpuIndex / 100, SCORING.cpuWeight);
    const platform = SCORING.platform[s.platform] !== undefined ? SCORING.platform[s.platform] : 1;
    const ram = (!s.unified && s.memory < 32) ? SCORING.ramPenalty : 1;
    const legacy = s.legacy ? SCORING.legacyPenalty : 1;
    const raw = gpu * features * vram * cpu * platform * ram * legacy;
    const relative = Math.min(1, raw / SCORING.reference);
    const score = Math.round(100 * (1 - Math.pow(1 - relative, SCORING.curve)));
    return { score, gpu, features, vram, cpu, platform, ram, legacy, raw, relative };
}
```

### Worked examples

| Build | GPU% | features | VRAM | CPU | platform | RAM | legacy | raw | P_rel | Score |
|---|---|---|---|---|---|---|---|---|---|---|
| RTX 5080 + 5700X3D, 16 GB VRAM, 32 GB DDR4, AM4 | 66 | 1.04 | 1.000 | √0.76 = 0.872 | 1.00 | 1.00 | 1.00 | 59.84 | 0.564 | **90** |
| RTX 5070 Ti + 5800X, 16 GB VRAM, 32 GB, AM4 | 57 | 1.04 | 1.000 | √0.69 = 0.831 | 1.00 | 1.00 | 1.00 | 49.24 | 0.464 | **83** |
| RTX 3060 Ti + 5700X3D, 8 GB VRAM, 16 GB RAM, AM4 | 27 | 1.00 | 0.900 | 0.872 | 1.00 | 0.97 | 1.00 | 20.55 | 0.194 | **45** |
| PlayStation 5 (unified 16 GB, index 52) | 22 | 0.98 | 1.000 | 0.721 | 1.00 | 1.00 | 1.00 | 15.55 | 0.147 | **36** |
| PlayStation 5 Pro (unified 16 GB, index 55) | 33 | 1.00 | 1.000 | 0.742 | 1.00 | 1.00 | 1.00 | 24.47 | 0.231 | **52** |
| Xbox Series S (unified 10 GB, index 51) | 11 | 0.98 | 0.887 | 0.714 | 1.00 | 1.00 | 1.00 | 6.83 | 0.064 | **17** |
| Xbox One X (unified 12 GB, index 18, legacy) | 11 | 0.92 | 0.925 | 0.424 | 1.00 | 1.00 | 0.80 | 3.18 | 0.030 | **8** |

The breakdown string shown in the UI is built in the same order, for example:
`GPU 66% × features 1.04 × VRAM 1.00 × CPU √(76/100) = 0.87 × platform 1.00 × RAM 1.00 = 59.8 → 56% of reference → score 90`.

---

## 5. Tiers and ranking

Bands are 14 points wide. S starts at 82, the floor every Nvidia 16 GB card clears. Each band is anchored to a console generation.

```js
const TIERS = [
    { key: 's', label: 'S TIER — FLAGSHIP',          min: 82, max: 100, ref: 'Nvidia 16GB class · beyond any console' },
    { key: 'a', label: 'A TIER — HIGH END',          min: 68, max: 81,  ref: 'Well above PS5 Pro' },
    { key: 'b', label: 'B TIER — ABOVE CURRENT GEN', min: 54, max: 67,  ref: 'Beats the PS5 Pro' },
    { key: 'c', label: 'C TIER — CURRENT GEN PRO',   min: 40, max: 53,  ref: 'PS5 Pro class' },
    { key: 'd', label: 'D TIER — CURRENT GEN',       min: 26, max: 39,  ref: 'PS5 / Series X class' },
    { key: 'e', label: 'E TIER — ENTRY CURRENT GEN', min: 12, max: 25,  ref: 'Series S class' },
    { key: 'f', label: 'F TIER — LAST GEN CLASS',    min: 0,  max: 11,  ref: 'Xbox One X / PS4 level' }
];
```

Ranking rules (`computeRankings`):

- Sort by score descending, then by raw performance descending.
- Standard competition ranking: tied scores share a rank and display `=` after the number; the next number is skipped (1, 2=, 2=, 4).
- An exact tie on both score and raw keeps `SYSTEMS` array order, so array order is the final tiebreak.
- Tier is the first band whose `min` the score reaches.
- The legend's band summary is generated from `TIERS`, so it never drifts.

---

## 6. Reference data

### GPU lookup

`GPU_DATABASE` is a list of `{ name, perf, vendor }` taken from TechPowerUp's relative performance chart with the RTX 5090 at 100. It covers roughly 180 cards from the RTX 5090 down to the GeForce 210. Copy it from the original file. Key anchors:

| Card | perf | | Card | perf |
|---|---|---|---|---|
| RTX 5090 | 100 | | RTX 4070 | 40 |
| RTX 4090 | 76 | | RTX 3080 | 39 |
| RTX 5080 | 66 | | RX 7800 XT | 39 |
| RTX 4080 SUPER | 59 | | RTX 5060 Ti 16 GB | 35 |
| RX 7900 XTX | 58 | | RTX 3070 Ti | 33 |
| RTX 5070 Ti | 57 | | RTX 3070 | 31 |
| RX 9070 XT | 55 | | RTX 5060 | 30 |
| RX 7900 XT | 50 | | RTX 3060 Ti | 27 |
| RX 9070 | 49 | | RTX 4060 | 24 |
| RTX 4070 Ti SUPER | 49 | | RX 7600 | 23 |
| RTX 5070 | 45 | | RTX 2070 SUPER | 22 |
| RTX 4070 Ti | 45 | | RX 6600 XT | 21 |
| RTX 4070 SUPER | 42 | | RTX 3050 8 GB | 13 |

Lookup order in `getGpuPerf`: normalise the name (lowercase, strip "GeForce", "Radeon", "Custom", "Edition", "Graphics", collapse whitespace), check a small fallback map for console equivalents, then exact match, then substring match. Unknown cards return 0, so always confirm a new card resolves.

`getGpuVram` extracts an explicit "12 GB" from the string when present, otherwise uses a per-model table. VRAM colour in the table: 32 GB red, 24 GB orange, 16 GB amber, 12 GB green, 10 GB cyan, 8 GB and under blue. Unified pools show "shared" in a muted style instead.

### CPU gaming index

Values used on the original list. Extend with published 1080p gaming averages, keeping the 9950X3D and 9800X3D at 100.

| CPU | cpuIndex | cpuTier | platform |
|---|---|---|---|
| Ryzen 9 9950X3D / 9800X3D | 100 | 6 | am5-x3d |
| Ryzen 7 7800X3D | 90 | 5 | am5-x3d |
| Ryzen 7 7700X | 80 | 3 | am5 |
| Ryzen 7 5800X3D | 79 | 4 | am4-x3d |
| Ryzen 7 5700X3D | 76 | 4 | am4-x3d |
| Ryzen 5 5500X3D | 73 | 4 | am4-x3d |
| Ryzen 7 5800X | 69 | 2 | am4 |
| Ryzen 5 5600X | 67 | 2 | am4 |
| Core i9-9900K | 64 | 1 | intel-9th |
| Ryzen 9 3900X | 62 | 1 | am4 |
| Ryzen 5 5500 | 60 | 2 | am4 |
| Core i7-8086K | 60 | 1 | legacy-intel |
| Ryzen 5 3600X | 59 | 1 | am4 |
| Ryzen 5 3600 | 58 | 1 | am4 |
| Zen 4 6-core @ 4.8 GHz (Steam Machine) | 64 | 0 | prebuilt |
| Zen 2 8-core @ 3.85 GHz (PS5 Pro) | 55 | 0 | console |
| Zen 2 8-core (PS5, Series X) | 52 | 0 | console |
| Zen 2 8-core @ 3.6 GHz (Series S) | 51 | 0 | console |
| Ryzen AI Z2 Extreme, Zen 5 8-core (ROG Xbox Ally X) | 50 | 0 | handheld |
| Core Ultra 7 258V (MSI Claw 8 AI+) | 48 | 0 | handheld |
| Ryzen Z1 Extreme, Zen 4 8-core (Legion Go S) | 46 | 0 | handheld |
| Ryzen Z2 A, Zen 2 4-core (ROG Xbox Ally) | 37 | 0 | handheld |
| Zen 2 4-core @ 3.5 GHz (Steam Deck) | 36 | 0 | handheld |
| ARM Cortex-A78C 8-core (Switch 2) | 34 | 0 | console |
| Jaguar 8-core @ 2.3 GHz (Xbox One X) | 18 | 0 | console |
| Jaguar 8-core @ 2.1 GHz (PS4 Pro) | 16 | 0 | console |
| Jaguar 8-core @ 1.75 GHz (Xbox One / One S) | 13 | 0 | console |
| Jaguar 8-core @ 1.6 GHz (PS4) | 12 | 0 | console |
| Tegra X1 (Switch) | 6 | 0 | console |

### Fixed-hardware reference rows

The consoles and handhelds are what make the tiers readable, so keep them all on the new list unchanged. Their key inputs:

| Device | class | gpuRef | upscaler | vram / memory | unified | legacy | Score |
|---|---|---|---|---|---|---|---|
| PlayStation 5 Pro | console | RTX 3070 Ti Custom | ml | 16 GDDR6 | yes | | 52 |
| Xbox Series X | console | RTX 2070 Super Custom | fsr | 16 GDDR6 | yes | | 36 |
| PlayStation 5 | console | RTX 2070 Super Custom | fsr | 16 GDDR6 | yes | | 36 |
| Steam Machine | prebuilt | RX 6600 XT Custom | fsr | 8 / 16 DDR5 | no | | 33 |
| Xbox Series S | console | GTX 1650 Super Custom | fsr | 10 GDDR6 | yes | | 17 |
| Legion Go S | handheld | GTX 1050 Ti Custom | fsr | 32 LPDDR5X | yes | | 12 |
| Nintendo Switch 2 | console | GTX 1650 Custom | ml | 12 LPDDR5X | yes | | 11 |
| Xbox One X | console | RX 580 Custom | none | 12 GDDR5 | yes | yes | 8 |
| PlayStation 4 Pro | console | GTX 1060 Custom | none | 8 GDDR5 | yes | yes | 7 |
| ROG Xbox Ally X | handheld | GTX 1650 Super Custom | fsr | 24 LPDDR5X | yes | | 19 |
| MSI Claw 8 AI+ | handheld | Arc 140V | ml | 32 LPDDR5X | yes | | 19 |
| ROG Xbox Ally | handheld | GTX 1050 Custom | fsr | 16 LPDDR5X | yes | | 8 |
| Steam Deck | handheld | GTX 1050 Custom | fsr | 16 LPDDR5 | yes | | 8 |
| PlayStation 4 | console | HD 7850 Custom | none | 8 GDDR5 | yes | yes | 2 |
| Xbox One S | console | HD 7790 Custom | none | 8 DDR3 | yes | yes | 2 |
| Xbox One | console | HD 7770 Custom | none | 8 DDR3 | yes | yes | 2 |
| Nintendo Switch | console | Maxwell 256 Cores | none | 4 LPDDR4 | yes | yes | 1 |

Copy the full objects (with profile, target, downside, upgrade, and rating notes) from the original file rather than rewriting them.

---

## 7. Editorial rules

These are decisions that the formula encodes or that were settled by hand. Apply them the same way.

- **Never hand-type a score, rank, or tier.** All three come from the formula. If a build feels wrong, adjust an input (index, gpuRef, upscaler) or add a `ratingNote`, never the output.
- **Nvidia cards with 16 GB or more (RTX 5070 Ti and up) are S tier by definition.** The constants were tuned so they clear 82 with any reasonable CPU. AMD cards do not follow the VRAM rule; an AMD build is placed by where it lands against the Nvidia cards on the list.
- **Near-ties go to the newer architecture** through the features and platform multipliers. A 7700X on AM5 edges a 5800X3D on AM4.
- **Consoles and handhelds are rated on their TV or docked output.**
- **PS5 and Xbox Series X are at parity** (same gpuRef and cpuIndex) because Digital Foundry head-to-heads average within a few percent. Series X lists first because its hardware is stronger on paper. Explain this with a `ratingNote` on the Series X.
- **Fixed platforms that testing shows below their paper spec** get a `gpuRef` that matches measured results, plus a `ratingNote` citing the source (the Steam Machine is rated just below an RX 7600 for this reason).
- **Switch 2 sits at the top of F**, above the Xbox One X, because it has ML upscaling and runs current releases.
- **The ROG Xbox Ally X ties the MSI Claw 8 AI+ and lists above it; the ROG Xbox Ally ties the Steam Deck and lists above it.** Both are rated on plugged-in output at their full power limit. Each carries a `ratingNote` explaining the tie and the ordering, and array order is what places them first.
- **LGA1700 owners (`intel-1700`) get a drop-in 14th gen chip recommended** (14700K or 14900K depending on the target) rather than a platform move, for the same DDR5 reason.
- **Use the `Custom` suffix on every console or handheld gpuRef** so the lookup treats it as shared hardware.
- **Set `updated`** to the date of any hardware change, and `added` on every new entry, so the badges appear for 60 days.
- **Upscaler ratings follow upscaler quality, not the presence of a frame-generation mode.** RX 7000 cards rate `ml` now that FSR 4.1 (June 2026) runs machine-learned upscaling on RDNA 3; RX 6000 and older stay `fsr`. Intel Arc, including the Arc 140V in the MSI Claw 8 AI+, stays `ml` even though XeSS 3 offers 3X/4X multi-frame generation, because `mfg` and `fg` mark the DLSS 4 and DLSS 3 quality tiers rather than the existence of a multiplier. Apply this the same way on every list.

### Upgrade path wording (as of September 2026)

The Upgrade text is written for current prices, and the legend says so. Rules used on the original list:

- DDR5 is very expensive, so a platform move to AM5 is deferred to 2027 for everyone. Say this explicitly.
- Every non-X3D DDR4 desktop on AM4 gets a drop-in Ryzen 5000 X3D (5700X3D or 5800X3D) recommended as the one-part upgrade.
- Owners of dead Intel sockets (8th/9th gen) get a used or sale AM4 board plus a Ryzen 5000 X3D, still on their existing DDR4.
- Builds already on X3D chips are told to keep the CPU and cascade a better GPU later.
- Builds with 16 GB system RAM are told to go to 32 GB of DDR4 while it is cheap, before the GPU.
- Builds with 8 GB VRAM are told to target 12 GB or more on the next card.
- Consoles and handhelds get a one-line "no upgrade path" statement.
- GTA 6 context if it comes up: console-only on 19 November 2026 at 30 fps, PC port unannounced and expected 2027 to 2028, so it is not a reason to buy DDR5 now.

Write profile, downside, and upgrade in plain, slightly enthusiastic prose. One to three sentences each. Avoid jargon the group would not use.

---

## 8. Checklist for building the new list

1. Create a new repo, enable GitHub Pages on `main` at root.
2. Copy `index.html` from the original repo. Keep the CSS, the scoring code, `TIERS`, `GPU_DATABASE`, the CPU index conventions, the rendering functions, the comparison engine, and every console and handheld entry.
3. Change the header title and subtitle for the new group. Update the "Data last reviewed" date in the legend footer.
4. Replace the desktop entries in `SYSTEMS` with the new group's builds, one object each, following the field guide in section 3. Pick `cpuIndex` from the table in section 6 and look up any new CPU from published 1080p averages. Confirm every `gpuRef` resolves to a non-zero value in `GPU_DATABASE`.
5. Open the page locally (`npm install` then `npm run dev`, or just open the file) and read each row's Score Breakdown to check the terms look right.
6. Sanity-check the ladder against the rules in section 7: every Nvidia 16 GB card in S, consoles in the bands their tier labels name, no hand-typed numbers anywhere.
7. Run the ladder check in section 9 and read the output against step 6.
8. Commit and push. Do not run any script that rewrites `index.html` unless you have read what it does first.

---

## 9. Ladder check

Run this with Node from the repo root. It prints the ranked ladder with tier headings and badge state, and lists any `gpuRef` that resolves to 0. It only reads `index.html`.

```js
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const src = script.replace(/document\.addEventListener\('DOMContentLoaded'[\s\S]*?\n    \}\);\n/, '');
const ctx = {};
new Function('module', src + '\n; module.out = { SYSTEMS, computeRankings, getGpuPerf, TIERS, renderNewBadge, renderUpdatedBadge };')(ctx);
const { SYSTEMS, computeRankings, getGpuPerf, TIERS, renderNewBadge, renderUpdatedBadge } = ctx.out;
console.log('unresolved gpuRefs:', SYSTEMS.filter(s => getGpuPerf(s.gpuRef) === 0).map(s => s.id));
let tier = null;
for (const s of computeRankings(SYSTEMS)) {
  if (s.tier !== tier) { tier = s.tier; console.log('\n== ' + TIERS.find(t => t.key === tier).label); }
  console.log(String(s.rank + (s.tied ? '=' : '')).padStart(4), String(s.score).padStart(3), s.name.padEnd(20),
    (renderNewBadge(s) ? 'NEW ' : '') + (renderUpdatedBadge(s) ? 'UPDATED' : ''));
}
```
