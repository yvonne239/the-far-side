/**
 * HIDDEN IN PLAIN SIGHT — the second path around the Moon.
 *
 * Path A ("Behind the Moment") flips a human moment to the feelings behind it.
 * This path flips a familiar sight to the mechanism or the infrastructure
 * behind it. Same Moon, same LOOK → FLIP → REVEAL, different feeling:
 * curiosity instead of empathy.
 *
 * Every entry carries its own source. Where a reveal is a simulation or a
 * composite rather than a measurement, it says so in `caveat` and that caveat
 * is rendered, not optional.
 */

export const CATEGORIES = {
  mechanism: {
    label: 'How does it work?',
    short: 'Mechanism',
    color: '#5fe0cf',
    blurb: 'Something ordinary, and the machinery hiding inside it.',
  },
  enablers: {
    label: 'What makes it possible?',
    short: 'Behind it',
    color: '#b9a6ff',
    blurb: 'Something convenient, and the people and systems holding it up.',
  },
};

export const CATEGORY_ORDER = ['mechanism', 'enablers'];

export const DISCOVERIES = [
  /* ============================================================
     1 · the Moon corrects the premise of its own nickname
     ============================================================ */
  {
    id: 'dark-side',
    category: 'mechanism',
    widget: 'sunlab',
    front: {
      label: 'The Moon',
      emoji: '🌑',
      question: 'The dark side of the Moon never sees the Sun… right?',
      gradient: 'linear-gradient(135deg, #2b3350 0%, #5a6690 55%, #cfc6b4 100%)',
      pos: { left: '6%', top: '16%' },
    },
    flip: {
      headline: 'Plot twist: I get sunlight too.',
      lead: 'Move the Sun around me and watch which half is lit.',
    },
    explain: [
      'The Moon is tidally locked to Earth: it turns once on its own axis in exactly the time it takes to orbit us. So one hemisphere always points our way, and one always points away. That second hemisphere is the far side — a fact about which direction it faces, not about whether light reaches it.',
      'Over one cycle of about 29.5 days, nearly every part of the Moon gets roughly two weeks of daylight and two weeks of night. When you look up at a New Moon and see almost nothing, the far side is in full sunlight.',
    ],
    caveat:
      'One place really is close to permanently dark: the floors of some deep craters near the poles sit low enough that sunlight never reaches them. That is why those craters can hold water ice.',
    connections: [
      {
        label: 'We had never seen it until 1959',
        text: 'No one on Earth had laid eyes on the far side until the Soviet probe Luna 3 flew behind the Moon and sent back the first grainy photographs. It looks different from the near side — far more cratered, with almost none of the dark volcanic plains.',
      },
      {
        label: 'Tidal locking is common',
        text: 'It is what happens when a body spends long enough being squeezed by a larger one nearby. Most large moons in the Solar System keep one face toward their planet, and Pluto and Charon have gone further still: they are locked to each other, each permanently hanging over one spot on the other.',
      },
      {
        label: 'The far side is a quiet place to listen',
        text: 'With the whole Moon between it and Earth, the far side is shielded from our radio noise. That makes it one of the most interesting places anyone could put a radio telescope.',
      },
    ],
    source: { label: 'NASA — Moon facts', url: 'https://science.nasa.gov/moon/facts/' },
    anchor: { lat: 14, lon: -58 },
  },

  /* ============================================================
     2 · petrichor
     ============================================================ */
  {
    id: 'petrichor',
    category: 'mechanism',
    widget: 'petrichor',
    front: {
      label: 'After the rain',
      emoji: '🌧️',
      question: 'Why does the ground smell different after rain?',
      gradient: 'linear-gradient(135deg, #3a6b5c 0%, #4f8fa8 55%, #9fb9c8 100%)',
      pos: { left: '13%', top: '58%' },
    },
    flip: {
      headline: 'The ground is exhaling.',
      lead: 'Drop water onto porous soil and follow the bubbles.',
    },
    explain: [
      'Filmed at thousands of frames per second, a raindrop landing on a porous surface does something unexpected: at the moment of contact it traps tiny bubbles of air against the ground. The bubbles shoot up through the flattened drop and burst at its surface, firing out a fine spray of droplets far smaller than the rain itself.',
      'Those aerosols carry whatever was sitting in the soil up into the air — including compounds made by the bacteria living there. MIT researchers found light and moderate rain released more of them than a heavy downpour, and porous ground released more than dense, packed surfaces.',
    ],
    caveat:
      'This is one contributor to that smell, not the whole explanation. The earthy note is usually credited to geosmin, a compound made by soil microbes, and other smells mix in as well — the sharpness before a storm, oils lifted off dry plants and pavement.',
    connections: [
      {
        label: 'The ocean does the same thing, constantly',
        text: 'Bursting bubbles on the sea surface throw salt, organic matter and microbes into the atmosphere. Those sea-spray aerosols go on to seed clouds, which makes a bubble popping on a wave a small part of how weather works.',
      },
      {
        label: 'Why it smells stronger on some ground',
        text: 'The mechanism needs pores for air to get trapped in. Sandy clay and dry soil release a lot; smooth, dense surfaces release very little — which is why a wet stone slab smells like almost nothing while a garden bed smells like a garden.',
      },
      {
        label: 'You have tasted this',
        text: 'Bubbles bursting in a fizzy drink fling aroma out of the liquid and toward your nose. Much of what you think you taste in a sparkling drink arrives the same way the smell of rain does.',
      },
    ],
    source: {
      label: 'MIT News — rainfall can release aerosols',
      url: 'https://news.mit.edu/2015/rainfall-can-release-aerosols-0114',
    },
    anchor: { lat: -18, lon: -8 },
  },

  /* ============================================================
     3 · a damaged QR code
     ============================================================ */
  {
    id: 'qr-code',
    category: 'mechanism',
    widget: 'qr',
    front: {
      label: 'A scratched label',
      emoji: '🔲',
      question: 'I scratched the code. Why does it still scan?',
      gradient: 'linear-gradient(135deg, #1f2430 0%, #6f7790 50%, #e8e4da 100%)',
      pos: { left: '67%', top: '20%' },
    },
    flip: {
      headline: 'It was written expecting damage.',
      lead: 'Scratch the illustration and watch the recovery budget.',
    },
    explain: [
      'A QR code does not store your link once. It stores it wrapped in extra mathematics — Reed–Solomon error correction — that lets a reader rebuild pieces it cannot see. The code is generated at one of four levels, and the level decides how much of that redundancy is packed in: roughly 7%, 15%, 25% or 30% of the code restorable, from the lightest to the heaviest.',
      'That budget is why a coffee ring, a crease or a logo dropped in the middle of a code often makes no difference at all. It is also why designers get away with putting a logo there: the damage was paid for in advance.',
      'The three large squares in the corners are doing a different job. They are finder patterns — the marks a reader hunts for to work out where the code is, how big it is and which way up. Lose those and the reader may never get as far as decoding anything.',
    ],
    caveat:
      'This is an illustration, not a scanner. Nothing here is being decoded, the grid is decorative rather than a real encoded message, and plenty of genuinely damaged codes in the world do fail. What it shows is the idea of a redundancy budget — not a promise that a damaged code will scan.',
    connections: [
      {
        label: 'The same maths reads scratched CDs',
        text: 'Reed–Solomon coding was published in 1960 and went on to sit underneath CDs, DVDs, digital television and hard drives. It is the reason a scratched disc plays through the scratch instead of stopping.',
      },
      {
        label: 'And it came back from deep space',
        text: 'Spacecraft send data across distances where a clean signal is impossible. Voyager used Reed–Solomon coding on its way past the outer planets, so images could survive the noise of the journey rather than having to be sent again.',
      },
      {
        label: 'Redundancy is a design choice everywhere',
        text: 'Postcodes, bank account check digits, ISBNs and shipping barcodes all carry extra characters whose only job is to catch mistakes. Once you notice the pattern you start seeing spare capacity built into things that look minimal.',
      },
    ],
    source: {
      label: 'DENSO WAVE — QR Code error correction',
      url: 'https://www.denso-wave.com/en/system/qr/fundamental/qrcode/qrc/',
    },
    anchor: { lat: 30, lon: 64 },
  },

  /* ============================================================
     4 · the "cloud"
     ============================================================ */
  {
    id: 'cloud',
    category: 'enablers',
    widget: 'nodemap',
    front: {
      label: 'Backing up a photo',
      emoji: '☁️',
      question: 'Your photo floats up into a soft little cloud.',
      gradient: 'linear-gradient(135deg, #7fa8d8 0%, #bcd3ec 50%, #f4f1ea 100%)',
      pos: { left: '70%', top: '58%' },
    },
    flip: {
      headline: 'The cloud is a building. Several, actually.',
      lead: 'Open the cloud and follow what the photo actually touches.',
    },
    widgetData: {
      rootLabel: 'Your photo',
      rootIcon: '🖼️',
      rootText:
        'You tap upload and the picture leaves your hand. Everything below is what it lands on. None of it is a metaphor.',
      nodes: [
        {
          id: 'network', icon: '🛰️', label: 'The journey', x: 0.18, y: 0.34,
          text: 'The photo travels as light and radio: your phone to a mast or router, into fibre under the street, through an exchange, and often across an ocean on a cable lying on the seabed. Almost none of the world\'s internet traffic goes by satellite.',
        },
        {
          id: 'building', icon: '🏢', label: 'A data centre', x: 0.5, y: 0.3,
          text: 'It arrives at a physical building, usually windowless, chosen for cheap reliable power, cool climate and network connections. Rows of racks, raised floors, a lot of noise.',
        },
        {
          id: 'disks', icon: '💽', label: 'Disks and flash', x: 0.82, y: 0.35,
          text: 'The file is written onto real drives — and then written again, because one copy is not storage, it is a single point of failure. Providers typically keep several copies spread across separate machines.',
        },
        {
          id: 'power', icon: '⚡', label: 'Electricity', x: 0.18, y: 0.66,
          text: 'The racks draw power continuously, whether or not anyone is looking at their photos. Behind that: a grid connection, substations, uninterruptible power supplies and backup generators that exist for the minutes when the grid does not.',
        },
        {
          id: 'cooling', icon: '❄️', label: 'Cooling', x: 0.5, y: 0.72,
          text: 'Every watt that goes into a server comes back out as heat, and hot electronics fail. Removing that heat — air handling, chilled water, sometimes liquid straight to the chip — is a large share of what a data centre spends energy on, which is why efficient cooling design is its own engineering discipline.',
        },
        {
          id: 'people', icon: '🧰', label: 'People', x: 0.82, y: 0.68,
          text: 'Technicians swapping failed drives, network engineers, electricians, security staff, cleaners, and someone on call at three in the morning when a rack stops answering. The cloud has a night shift.',
        },
      ],
    },
    explain: [
      '"The cloud" is a good name for how it feels and a bad name for what it is. Somewhere your photo is a pattern of charge on a real drive, in a real building, drawing real power, being kept at a temperature by machinery someone maintains.',
      'None of that is a reason to feel bad about backing up a photo. It is a reason to find it remarkable: a global system of buildings, cables, generators and staff, running continuously so that a thing you did with one thumb feels like nothing at all.',
    ],
    caveat:
      'Per-photo energy figures get quoted a lot online and almost none of them hold up — the cost of one upload is not meaningfully measurable, and it is not the interesting number anyway. What is well established is that this is physical infrastructure which must be powered and cooled continuously, and that its efficiency is an active field of engineering.',
    connections: [
      {
        label: 'The internet is mostly underwater',
        text: 'Hundreds of fibre-optic cables cross the ocean floor, laid and repaired by a small fleet of specialised ships. When a country suddenly loses international connectivity, a cable break is a common reason.',
      },
      {
        label: '"The cloud" has geography',
        text: 'Which building your data sits in affects how fast it loads and which country\'s laws apply to it. That is why providers advertise regions, and why some organisations must keep data inside particular borders.',
      },
      {
        label: 'Where does the heat go?',
        text: 'Some places have stopped treating it as waste. Data centres in several cities now pipe their warm water into district heating networks, so the building that stores your photos also heats the flats next door.',
      },
    ],
    source: {
      label: 'US DOE — best practices for energy-efficient data centre design',
      url: 'https://www.energy.gov/cmei/femp/articles/best-practices-guide-energy-efficient-data-center-design',
    },
    anchor: { lat: -34, lon: 112 },
  },

  /* ============================================================
     5 · the concert that looked effortless
     ============================================================ */
  {
    id: 'concert',
    category: 'enablers',
    widget: 'nodemap',
    front: {
      label: 'A night out',
      emoji: '🎤',
      question: 'The concert looked completely effortless.',
      gradient: 'linear-gradient(135deg, #8f3fb0 0%, #ff5f8f 55%, #ffc46b 100%)',
      pos: { left: '38%', top: '10%' },
    },
    flip: {
      headline: 'Effortless is a finish, not a start.',
      lead: 'Two hours on stage, and the week stacked underneath them.',
    },
    widgetData: {
      rootLabel: 'Two hours on stage',
      rootIcon: '✨',
      rootText:
        'The part you were in the room for. Everything below happened so that this part could look like it happened by itself.',
      nodes: [
        {
          id: 'rehearsal', icon: '🎼', label: 'Rehearsal', x: 0.18, y: 0.32,
          text: 'The set order, the transitions, the bit where the lights change on a specific beat. Most of what reads as spontaneity on stage is a decision someone made on a Tuesday afternoon in a much uglier room.',
        },
        {
          id: 'buildin', icon: '🔩', label: 'Load-in and build', x: 0.5, y: 0.26,
          text: 'Trucks arrive in the morning. Staging, rigging above people\'s heads, lighting bars, cable runs taped down so nobody trips. Hours of physical work, finished before the doors open, invisible by design.',
        },
        {
          id: 'sound', icon: '🎛️', label: 'Sound and lighting', x: 0.82, y: 0.33,
          text: 'A room is an instrument with its own bad habits. Sound check is a crew arguing with the room until it behaves, and then someone mixes the whole show live, in the dark, in real time.',
        },
        {
          id: 'foh', icon: '📋', label: 'Running the show', x: 0.18, y: 0.64,
          text: 'Stage management calls the cues. Box office, bar, accessibility seating, the person who knows where the spare battery for the radio mic is. The show runs on a timeline someone is holding.',
        },
        {
          id: 'volunteers', icon: '🎟️', label: 'Ushers and volunteers', x: 0.5, y: 0.7,
          text: 'At community and student events especially, a good share of the people making the night work are unpaid: taking tickets, pointing at the toilets, watching the crowd for anyone in trouble.',
        },
        {
          id: 'getout', icon: '🧹', label: 'Load-out and cleanup', x: 0.82, y: 0.66,
          text: 'The get-out starts when you leave. Everything built that morning comes down that night, the floor is cleared, and the trucks go. Someone finishes work at four in the morning so the room can be a different room tomorrow.',
        },
      ],
    },
    explain: [
      'Polish is not the absence of effort. It is effort moved out of sight — scheduled earlier, rehearsed harder, and cleaned up after everyone has gone home.',
      'It is worth noticing because the same trick runs everywhere: a smooth lecture, a calm restaurant service, a website that simply works. Effortlessness is usually a claim about where the work was put, not whether it happened.',
    ],
    caveat:
      'This is an illustrative composite of how live events are generally put together, not a report on any particular show. No real crew member is being quoted here.',
    connections: [
      {
        label: 'Sound check takes longer than the set',
        text: 'Every room reflects sound differently, and a room full of people absorbs it differently again. Crews spend hours tuning a system for an audience that is not there yet, then adjust once it is.',
      },
      {
        label: 'The crew often works the longest day',
        text: 'Performers arrive for their slot. The crew was there for load-in and is still there for load-out, which routinely makes the shortest part of the night the only part anybody saw.',
      },
    ],
    source: null,
    anchor: { lat: 40, lon: 168 },
  },
];

/** Lines shown, in order, while orbiting on the discoveries path. */
export const DISCOVERY_FLIGHT_LINES = [
  'Leaving the side you already knew…',
  'The obvious explanation falls away.',
  'One face of the Moon never turns toward Earth.',
  'Whatever is back here was always back here.',
  'Arriving at the far side.',
];

export function getDiscovery(id) {
  return DISCOVERIES.find((d) => d.id === id) || null;
}
