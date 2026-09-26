# Moonflip

**Flip the Moon. See what you missed.**

An interactive Moon that asks one question: *what else is happening here?*

The half of the Moon facing Earth is the half we notice first. Fly around it and
there is always another side — one that was there the whole time, just pointed
somewhere else. Sometimes what is back there is a person's unseen effort or
feeling. Sometimes it is a surprising mechanism inside something ordinary, or the
people and infrastructure holding up a convenience nobody thinks about.

Two paths leave the same opening screen. Both use the same Moon and the same
interaction — **look → flip → reveal** — and you can switch between them at any
point without restarting.

| Arrive | The far side |
| --- | --- |
| ![The opening screen, with the Moon behind it](docs/screenshot-intro.png) | ![The far side of the Moon, scattered with lights joined by faint constellation strands](docs/screenshot-far-side.png) |

> The repository is still called `the-far-side`, so the published URL keeps its
> existing path. Only the product name changed.

---

## Path one — Behind the Moment

*Human stories. Feeling: empathy.*

A visible achievement or a happy photo, and the context someone chose to share
about it.

| What people saw | What was outside the frame |
| --- | --- |
| "I got the internship!" | "I was rejected 18 times first, and I never told anyone I was applying." |
| "Best first semester ever 🌙" | "I always have people to sit with and nobody I could call at 2am." |
| "So grateful for my family ❤️" | "I go home every weekend to help care for my mum, and I am so tired." |

1. **Arrive.** Cards styled like a social feed drift over the near side, with
   notification toasts and a busy, overlapping soundscape.
2. **Fly.** Selecting a post asks *"What might be outside this frame?"* The camera
   swings around the limb carrying the post with it; its polished image shrinks
   into a single point of light and the noise crossfades into a slow warm chord.
3. **Discover.** The light lands on the far side and opens its story. Filter by
   broad experience — belonging, work, family, identity, uncertainty.
4. **Respond.** Instead of a like button, send a short signal ("I hear you"). A
   beam travels from where you landed, up through an orbiting relay satellite and
   down onto the story's light, leaving a faint strand behind. Those strands build
   a constellation. There are no popularity scores anywhere in the piece.
5. **Return.** Write your own two lines, then take one small real-world action
   with the message already written for you.

All stories shipped with the project are **clearly labelled samples** written for
the demo. No real person's words are in this repository.

## Path two — Hidden in Plain Sight

*Everyday discoveries. Feeling: curiosity.*

Something familiar, flipped — under one of two questions:

- **How does it work?** — the mechanism hiding inside the ordinary thing.
- **What makes it possible?** — the people, places and systems behind the
  convenience.

Five interactive reveals, each with its source on the panel:

| | Front | Flip | You can |
| --- | --- | --- | --- |
| 🌑 | "The dark side of the Moon never sees the Sun… right?" | *Plot twist: I get sunlight too.* | Drag the Sun through a 29.5-day cycle and watch the terminator move across **the real 3D Moon behind the panel**, next to a top-down diagram of Sun, Moon and Earth. |
| 🌧️ | "Why does the ground smell different after rain?" | *The ground is exhaling.* | Release a raindrop, zoom into the contact point, and watch trapped air bubbles rise and burst into aerosols. Compare light rain with a downpour, porous soil with packed stone. |
| 🔲 | "I scratched the code. Why does it still scan?" | *It was written expecting damage.* | Scratch a QR illustration and watch the recovery budget, at each of the four error-correction levels — then find out why the corner squares are different. |
| ☁️ | A photo floats into a soft little cloud. | *The cloud is a building. Several, actually.* | Open the cloud into a branching map — journey, data centre, disks, electricity, cooling, people — and read each node. |
| 🎤 | "The concert looked completely effortless." | *Effortless is a finish, not a start.* | Open the night into rehearsal, load-in, sound crew, stage management, volunteers and the get-out. |

Every reveal carries a **"worth being precise about"** note saying where the
simulation stops and where the evidence actually is — the QR widget is an
illustration and not a scanner, petrichor is one contributor to the smell and not
the whole story, the concert is an illustrative composite rather than testimony,
and no per-photo energy figure is claimed for the cloud. Each discovery then
offers **wider connections** to follow: undersea cables, Reed–Solomon in Voyager,
sea-spray aerosols, tidal locking in the rest of the Solar System.

## The music, and why it isn't *Fly Me to the Moon*

Once the Moon has flipped and you arrive on the far side — on either path — a
theme fades in and the ambient pad ducks underneath it.

The obvious tune for a project on this theme is "Fly Me to the Moon", and it is
not ours to ship. Bart Howard wrote it in 1954 and the composition is under
copyright into the 2040s; every recording of it carries a second, separate
copyright in the master. So there is no part of that song in this repository.

**What plays by default** is an original instrumental written for the project
and synthesised in the browser like everything else here. It sits on the
circle-of-fifths turnaround those standards share — Am7 · Dm7 · G7 · Cmaj7 ·
Fmaj7 · Bm7♭5 · E7 · Am6, slow 3/4, brushes and upright-ish bass — because chord
progressions are common property and that progression is most of why those tunes
feel the way they do. The melody over it is deliberately nobody else's melody.

**To use a real recording** you have licensed, drop the file in `assets/` and
point one constant at it:

```js
// src/audio/music.js
export const MOON_THEME_URL = './assets/moon-theme.mp3';
```

Anything the browser can decode works. It is looped, ducked and muted exactly
like the built-in version, and if it fails to load the instrumental takes over
rather than leaving silence.

### A note on "dark side"

The far side is the hemisphere pointing away from Earth. That is a fact about
direction, not about light: over one cycle nearly all of it gets about two weeks
of sunlight and two weeks of night, and at New Moon it is in full daylight. The
project keeps the phrase *far side* for the geography and makes the misconception
the very first thing the Moon corrects about itself. (The genuine exception —
permanently shadowed polar crater floors — is in the panel too.)

---

## Run it

There is **no build step and no dependencies to install.** The only requirement
is that the files are served over `http://` (ES modules and import maps do not
work from `file://`).

```bash
git clone https://github.com/<your-username>/the-far-side.git
cd the-far-side

python3 -m http.server 8000        # any static server works
# then open http://localhost:8000
```

Alternatives: `npx serve .`, `php -S localhost:8000`, or VS Code's *Live Server*.

**Requirements:** any current desktop or mobile browser with WebGL
(Chrome, Edge, Safari 16+, Firefox). Three.js is loaded from a CDN via an import
map, so the first load needs an internet connection.

### Deploy to GitHub Pages

The repo ships with `.github/workflows/deploy.yml`, which publishes the site on
every push to `main`. In your repository: **Settings → Pages → Build and
deployment → Source: GitHub Actions**. That's it — no build, the repo root is
the site. The repository name is unchanged, so the published URL stays put.

---

## How it's built

Vanilla ES modules, [three.js](https://threejs.org) r161 via import map, the Web
Audio API, and CSS. No framework, no bundler, and no binary assets in the site
itself — the Moon and Earth textures are drawn into a `<canvas>` at load time
from a seeded PRNG, and every sound is synthesised in the browser. (The only
images in the repo are the README screenshots.)

```
index.html               markup for every screen, both paths
styles/
  base.css               tokens, stage, projected marker layer
  ui.css                 panels, path cards, feed + sight cards, forms
  discover.css           the reveal panel and all four widgets
src/
  main.js                the router: paths, phases, and all wiring
  data/
    stories.js           the paired sample stories, themes, signals, copy
    discoveries.js       the five discoveries, their content and their sources
    actions.js           return-to-Earth actions + copyable messages
  moon/
    scene.js             Moon, tracked lights, relay, flight, beams, sun lab
    textures.js          procedural Moon and Earth textures
  audio/
    soundscape.js        four synthesised worlds and the crossfades between them
    music.js             the far-side theme: original instrumental, or your file
  ui/
    feed.js              near-side feed cards + comparison toasts (path one)
    sights.js            near-side everyday sights (path two)
    farside.js           filters, story panel, signal relay buttons
    discover.js          filters, reveal panel, widget lifecycle
    widgets/
      sunlab.js          the lunar cycle, driving the diagram and the real Sun
      petrichor.js       canvas simulation of bubble-burst aerosols
      qr.js              scratchable QR illustration + error-correction budget
      nodemap.js         branching map of what holds something up
    contribute.js        the two-sided reflection form
    closing.js           return-to-Earth actions and clipboard
  lib/
    util.js              seeded PRNG, easing, lunar surface coordinates
    storage.js           localStorage — the only persistence layer
```

### Details worth knowing

- **Coordinates.** Longitude `0°` points at `-Z`, the centre of the far side.
  three.js' default sphere UVs put `-Z` at `u = 0.75`, so the right half of the
  generated texture is the far side and the left half is the maria-scarred near
  side. `surfacePoint(lat, lon)` in `lib/util.js` is the single source of truth.
- **Two paths, one Moon.** Every far-side light belongs to a `track` (`story` or
  `discovery`). `MoonScene.setTrack()` decides which set exists on the surface, so
  the two paths share the Moon, the flight and the camera without ever sharing a
  constellation. Switching paths keeps everything you have already done.
- **The flight actually lands.** Before the camera swings around, the Moon is
  rotated so the selected light's longitude ends up facing the camera's final
  position, and the travelling card is slerped along a great circle in the Moon's
  local space — so it arrives exactly on its own light rather than near it. The
  two paths differ only in the `mood` the lighting lands on: warm, or clear.
- **The Sun really moves.** The "dark side" reveal takes over the scene lighting
  via `enterSunLab()`, and the slider drives `setSunAngle()` in the Moon's own
  frame — which is what tidal locking means, so the illumination pattern stays put
  on the surface for a given point in the cycle. It is restored on close.
- **Lights are real buttons.** Each far-side light is a 3D sprite plus a DOM
  `<button>` projected onto it every frame, hidden when it rotates past the limb.
  So the far side is keyboard-navigable and screen-reader-visible. The ~220
  ambient "other people" lights on the stories path are GPU points with no DOM.
- **The widgets are reachable without a mouse.** The node maps are real buttons,
  the lunar cycle is a range input, and the QR illustration ships with *scratch a
  patch* / *scratch a corner square* / *repair* buttons so it can be driven from
  the keyboard as well as by dragging.
- **Earth is only visible from the near side.** It is a real object out past the
  limb; from the far side the Moon itself occludes it. That is the point.
- **`prefers-reduced-motion`** shortens the flight to ~2s, stills the drift
  animations, shortens every tween, and turns the lunar-cycle autoplay into a
  single step to New Moon.

## Privacy, and what this is not

- **No server, no analytics, no accounts, no network calls** other than the
  three.js and font CDNs. There is nothing to submit *to*.
- "Submit for anonymous sharing" is honest about this in the UI: it records your
  intent and saves the text in `localStorage` only. A real deployment would need
  moderation, rate limiting and a duty-of-care review before accepting a single
  real story — that is a policy problem, not a weekend coding problem.
- Everything you write can be deleted from the contribute panel, or by clearing
  site data.
- **This is an art piece, not a crisis service.** Nobody is monitoring what is
  typed here and nothing can reply. The experience links support resources
  (988 in the US/Canada, 116 123 in the UK/Ireland,
  [findahelpline.com](https://findahelpline.com) anywhere) from the opening and
  closing screens of the human-stories path.

## Sources

- The Moon, tidal locking and the lunar cycle — [NASA, *Moon facts*](https://science.nasa.gov/moon/facts/)
- Rain, bubbles and aerosols — [MIT News, *Rainfall can release aerosols, study finds*](https://news.mit.edu/2015/rainfall-can-release-aerosols-0114)
- QR error correction and finder patterns — [DENSO WAVE, *QR Code error correction feature*](https://www.denso-wave.com/en/system/qr/fundamental/qrcode/qrc/)
- Data centres, power and cooling — [US DOE, *Best practices guide for energy-efficient data center design*](https://www.energy.gov/cmei/femp/articles/best-practices-guide-energy-efficient-data-center-design)

## Credits

Concept, code and copy written for a hackathon on the theme *Fly Me to the Moon*.
Sample stories are fictional composites; no real person's words appear in this
repository.

## Licence

MIT — see [LICENSE](LICENSE).
