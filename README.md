# Moonflip

**Flip the Moon. See what you missed.**

An interactive Moon that asks one question: *what else is happening here?*

The half of the Moon facing Earth is the half we notice first. Fly around it and
there is always another side — one that was there the whole time, just pointed
somewhere else. Here, what is back there is the part of a moment someone chose
not to post.

One Moon, one interaction: **look → flip → reveal.**

| Arrive | The far side |
| --- | --- |
| ![The opening screen, with the Moon behind it](docs/screenshot-intro.png) | ![The far side of the Moon, scattered with lights joined by faint constellation strands](docs/screenshot-far-side.png) |

> The repository is still called `the-far-side`, so the published URL keeps its
> existing path. Only the product name changed.

---

## The journey

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
5. **Return.** Write your own two sides, then take one small real-world action
   with the message already written for you.

All stories shipped with the project are **clearly labelled samples** written for
the demo. No real person's words are in this repository.

### Writing your own

The "Add your two sides" panel opens from either side of the Moon. What you write
becomes two things at once: a light on the far side, and a post at the head of
the near-side feed carrying a gold **MINE** badge, `@you` and *just now*. Clicking
that post flies you round to your own light. Both are restored on reload and
removed together when you delete. Everything stays in `localStorage`.

## The music

Once the Moon has flipped, a theme fades in on the far side and the ambient pad
ducks under it. `src/audio/moonflip.mp3` is what plays, pointed at by
`MOON_THEME_URL` in `src/audio/music.js`. Set that constant to `null` and an
original synthesised instrumental plays instead — it also takes over
automatically if the file fails to load, and swaps in mid-flight if the recording
finishes decoding after the theme has already started.

"Fly Me to the Moon" itself is not in this repository: Bart Howard wrote it in
1954, the composition is under copyright into the 2040s, and every recording
carries a second copyright in the master.

### A note on "dark side"

The far side is the hemisphere pointing away from Earth. That is a fact about
direction, not about light: over one cycle nearly all of it gets about two weeks
of sunlight and two weeks of night, and at New Moon it is in full daylight. The
piece uses *dark side* for the mood of the place you arrive in, not as a claim
about sunlight.

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
the site.

---

## How it's built

Vanilla ES modules, [three.js](https://threejs.org) r161 via import map, the Web
Audio API, and CSS. No framework and no bundler.

```
index.html               markup for every screen
styles/
  base.css               tokens, stage, projected marker layer
  ui.css                 panels, feed cards, story panel, forms
src/
  main.js                the journey, and all the wiring
  data/
    stories.js           the paired sample stories, themes, signals, copy
    actions.js           return-to-Earth actions + copyable messages
  moon/
    scene.js             Moon, lights, relay, flight, beams, constellation
    textures.js          procedural fallback Moon and Earth textures
    moon_color.jpg       lunar albedo map (equirectangular)
    moon_height.jpg      matching height map, used as a bump map
  audio/
    soundscape.js        two synthesised worlds and the crossfade between them
    music.js             the far-side theme: the recording, or an original
    moonflip.mp3         the recording that plays on the far side
  ui/
    feed.js              near-side feed cards + comparison toasts
    farside.js           filters, story panel, signal relay buttons
    contribute.js        the two-sided reflection form
    closing.js           return-to-Earth actions and clipboard
  lib/
    util.js              seeded PRNG, easing, lunar surface coordinates
    storage.js           localStorage — the only persistence layer
```

### Details worth knowing

- **The Moon is a real map.** `scene.js` builds the sphere with a procedurally
  drawn texture first, then swaps in the photographic albedo and height maps once
  they load, so the scene is never blank and still works if they 404. The textures
  are offset a quarter turn: their 0° longitude sits at the centre of the image,
  while three.js' sphere UVs put `u = 0.25` at `+Z`, where the camera starts.
- **Coordinates.** Longitude `0°` points at `-Z`, the centre of the far side.
  `surfacePoint(lat, lon)` in `lib/util.js` is the single source of truth.
- **The flight actually lands.** Before the camera swings around, the Moon is
  rotated so the selected light's longitude ends up facing the camera's final
  position, and the travelling card is slerped along a great circle in the Moon's
  local space — so it arrives exactly on its own light rather than near it.
- **Lights are real buttons.** Each far-side light is a 3D sprite plus a DOM
  `<button>` projected onto it every frame, hidden when it rotates past the limb.
  So the far side is keyboard-navigable and screen-reader-visible. The ~220
  ambient "other people" lights are GPU points with no DOM.
- **Earth is only visible from the near side.** It is a real object out past the
  limb; from the far side the Moon itself occludes it. That is the point.
- **`prefers-reduced-motion`** shortens the flight to ~2s, stills the drift
  animations, and shortens every tween.

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
  closing screens.

## Sources

- The Moon's near and far sides, and the lunar cycle —
  [NASA, *Moon facts*](https://science.nasa.gov/moon/facts/)

## Credits

Concept, code and copy written for a hackathon on the theme *Fly Me to the Moon*.
Sample stories are fictional composites; no real person's words appear in this
repository.

## Licence

MIT — see [LICENSE](LICENSE).
