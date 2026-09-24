// The playlist. Each track is an arrangement of 8-bar sections.
// Patterns are 16 steps (16th notes): 'x' hit, 'o' soft hit, '.' rest.
// Darbuka strokes: D = dum (low, centre of the drum), T = tek (sharp, rim), k = soft ka.
// Degrees index into the track's scale (0 = root; 7 in a 7-note scale = the octave).

// A loose approximation of the Seikilos song, [semitones from E4, beats]: 32 beats, 8 bars.
export const SEIKILOS = [
  [5, 1], [12, 1], [12, 1], [9, 0.5], [10, 0.5], [12, 1], [10, 0.5], [12, 0.5], [10, 2],
  [9, 1], [10, 1], [12, 1], [15, 1], [14, 0.5], [12, 0.5], [14, 2],
  [12, 1], [10, 1], [9, 0.5], [7, 0.5], [9, 1], [5, 1], [7, 0.5], [5, 0.5], [4, 2],
  [5, 1], [9, 1], [7, 0.5], [5, 0.5], [4, 1], [5, 0.5], [7, 0.5], [2, 1], [0, 3],
];

const HIJAZ = [0, 1, 4, 5, 7, 8, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const PENTA_MINOR = [0, 3, 5, 7, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

const FOUR = 'x...x...x...x...';
const OFF = '..x...x...x...x.';
const TWO_FOUR = '....x.......x...';
const SIXTEENTHS = 'oooooooooooooooo';
const MAQSUM = 'D.T...T.D...T...';
const SAIDI = 'D.T...D.D...T...';
const FALLAHI = 'D.T.D.T.D.T.D.T.';
const _ = null;

export const TRACKS = [
  {
    name: 'Heru-Nefer',
    subtitle: 'hijaz house · maqsum rhythm · 118 bpm',
    note: 'The club’s anthem. “Make holiday!” was the refrain of the harpers’ songs. The darbuka plays maqsum, the backbone rhythm of modern Egyptian pop.',
    bpm: 118, root: 146.83, scale: HIJAZ,
    progression: [0, 0, 5, 4],
    arrangement: ['intro', 'groove', 'drop', 'break', 'drop', 'groove'],
    bass: { pattern: [0, _, 0, 1, _, 2, 0, _, -3, _, -3, -2, _, 0, 1, 2] },
    lead: { instrument: 'mizmar', bars: 1, every: { of: 4, at: 2, at2: 3 }, phrases: [
      [4, _, 3, 2, 1, _, 2, _, 1, 0, _, 1, 2, _, _, _],
      [6, _, 5, 4, 3, _, 4, _, 3, 2, _, 1, 0, _, _, _],
    ] },
    sections: {
      intro: { energy: 0.4, pad: true, drums: { kick: FOUR, hat: OFF, darbuka: MAQSUM, sistrum: '......x.......x.' }, riser: true },
      groove: { energy: 0.7, pad: true, fills: true, drums: { kick: FOUR, hat: OFF, clap: TWO_FOUR, darbuka: MAQSUM, sistrum: '......x.......x.' } },
      drop: { energy: 1, pad: true, lead: true, fills: true, riser: true, drums: { kick: FOUR, hat: 'o.x.o.x.o.x.o.x.', clap: TWO_FOUR, darbuka: MAQSUM, sistrum: '......x.......x.' } },
      break: { energy: 0.3, pad: true, lead: true, noBass: true, riser: true, drums: { darbuka: MAQSUM, sistrum: '......x.......x.' } },
    },
  },
  {
    name: 'Opening of the Mouth',
    subtitle: 'acid techno · phrygian · 128 bpm',
    note: 'Named after the ritual that brought statues to life. A priest touched the statue’s mouth with an adze so that it could eat, breathe, and speak. It’s why the statues here can dance.',
    bpm: 128, root: 164.81, scale: PHRYGIAN,
    progression: [0, 0, 0, 1],
    arrangement: ['intro', 'build', 'drop', 'drop', 'break', 'build', 'drop', 'outro'],
    bass: { type: 'acid', octave: -1, len: 1, pattern: [0, 0, 7, 0, 1, 0, 7, 1, 0, 0, 7, 0, 2, 1, 0, -1] },
    pad: { voicing: [0, 4], octave: -1, cutoff: 500 },
    stabs: { pattern: '...x.....x....x.', voicing: [0, 2, 4], octave: 1 },
    sections: {
      intro: { energy: 0.35, pad: true, noBass: true, drums: { kick: FOUR, ohat: OFF, rim: '...x..x....x..x.' } },
      build: { energy: 0.6, riser: true, drums: { kick: FOUR, ohat: OFF, hat: SIXTEENTHS, shaker: 'x.o.x.o.x.o.x.o.' } },
      drop: { energy: 1, stabs: true, drums: { kick: FOUR, ohat: OFF, hat: SIXTEENTHS, clap: TWO_FOUR, ride: 'x.x.x.x.x.x.x.x.', sistrum: '..............x.' } },
      break: { energy: 0.25, pad: true, stabs: true, riser: true, drums: { rim: '...x..x....x..x.' } },
      outro: { energy: 0.5, pad: true, drums: { kick: FOUR, ohat: OFF } },
    },
  },
  {
    name: 'Sekhmet’s Red',
    subtitle: 'mahraganat-flavoured club · saidi rhythm · hijaz on A · 136 bpm',
    note: 'The lioness goddess who was stopped from destroying humanity with 7,000 jars of beer dyed red. The rhythm is saidi, from Upper Egypt, where the mizmar (a loud double-reed horn) leads the dance.',
    bpm: 136, root: 220, scale: HIJAZ,
    progression: [0, 0, 3, 4],
    arrangement: ['intro', 'groove', 'drop', 'drop', 'break', 'drop', 'drop', 'outro'],
    bass: { pattern: [0, _, _, 0, _, _, 0, _, 0, _, _, 1, _, 2, _, _], octave: -2, cutoff: 1400 },
    lead: { instrument: 'mizmar', bars: 2, phrases: [
      [4, _, 4, 3, 2, _, 1, _, 2, 3, 4, _, 5, 4, 3, _, 2, _, 1, 2, 1, _, 0, _, _, _, 1, 2, 1, 0, _, _],
      [7, _, 6, 5, 4, _, 5, 4, 3, _, 2, _, 1, 2, 3, _, 4, _, 3, 2, 1, _, 2, 1, 0, _, _, _, _, _, _, _],
    ] },
    sections: {
      intro: { energy: 0.45, fills: true, drums: { darbuka: SAIDI, zill: 'x.x...x.x.x...x.' }, riser: true },
      groove: { energy: 0.7, fills: true, drums: { kick: 'x.....x.x.......', darbuka: SAIDI, hat: OFF, zill: 'x.x...x.x.x...x.' }, riser: true },
      drop: { energy: 1, lead: true, fills: true, drums: { kick: 'x...x...x...x.x.', clap: TWO_FOUR, darbuka: SAIDI, hat: 'o.x.o.x.o.x.o.x.', zill: 'x.x...x.x.x...x.' } },
      break: { energy: 0.3, lead: true, noBass: true, pad: true, riser: true, drums: { zill: 'x...............' } },
      outro: { energy: 0.5, drums: { darbuka: SAIDI, kick: FOUR } },
    },
  },
  {
    name: 'The Solar Barque',
    subtitle: 'melodic house · minor pentatonic · 122 bpm',
    note: 'Every night the sun god sailed his boat through the twelve hours of the underworld and rose again at dawn. The tomb text that maps the trip is the Amduat, “What Is in the Underworld”. The lead is a ney, the reed flute pictured in Egyptian tombs.',
    bpm: 122, root: 130.81, scale: PENTA_MINOR,
    progression: [0, 0, 3, 2],
    arrangement: ['intro', 'build', 'drop', 'drop', 'break', 'drop', 'drop', 'outro'],
    bass: { type: 'sub', follow: true, pattern: [0, _, _, 0, _, _, _, _, 0, _, _, 0, _, _, 1, _], octave: -1 },
    pad: { voicing: [0, 2, 4], octave: 0, cutoff: 900 },
    arp: { pattern: [0, 2, 4, 2, 5, 4, 2, 4, 0, 2, 4, 2, 6, 4, 2, 1], octave: 1, instrument: 'lyre' },
    lead: { instrument: 'ney', bars: 4, len: 8, phrases: [
      [4, _, _, _, _, _, _, _, 5, _, _, _, _, _, _, _, 4, _, _, _, 3, _, _, _, 2, _, _, _, _, _, _, _,
       3, _, _, _, _, _, _, _, 2, _, _, _, 1, _, _, _, 0, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    ] },
    sections: {
      intro: { energy: 0.3, arp: true, pad: true, drums: { shaker: 'x.o.x.o.x.o.x.o.' } },
      build: { energy: 0.6, arp: true, pad: true, riser: true, drums: { kick: FOUR, hat: OFF, shaker: 'x.o.x.o.x.o.x.o.' } },
      drop: { energy: 0.95, arp: true, pad: true, drums: { kick: FOUR, hat: OFF, clap: '............x...', shaker: 'x.o.x.o.x.o.x.o.', darbuka: 'D.......D.D.....' } },
      break: { energy: 0.25, pad: true, lead: true, noBass: true, riser: true, drums: {} },
      outro: { energy: 0.4, arp: true, pad: true, drums: { kick: FOUR, shaker: 'x.o.x.o.x.o.x.o.' } },
    },
  },
  {
    name: 'Festival of Drunkenness',
    subtitle: 'disco house · fallahi rhythm · finger cymbals · 124 bpm',
    note: 'At Hathor’s Festival of Drunkenness, celebrants drank until they passed out and were woken by drums to see the goddess. Hatshepsut built a “Porch of Drunkenness” at the temple of Mut. The zills (finger cymbals) belong to Egyptian dance.',
    bpm: 124, root: 196, scale: MIXOLYDIAN, swing: 0.12,
    progression: [0, 0, 3, 4],
    arrangement: ['groove', 'drop', 'drop', 'break', 'drop', 'drop'],
    bass: { follow: true, pattern: [0, _, 7, _, 0, 7, _, 0, _, 0, 7, _, 4, _, 6, _], octave: -1, cutoff: 1600, len: 0.7 },
    stabs: { pattern: '..x..x....x..x..', voicing: [0, 2, 4, 6], octave: 1 },
    lead: { instrument: 'bell', bars: 2, len: 2, phrases: [
      [7, _, 9, _, 11, _, 9, _, 7, _, 6, _, 4, _, _, _, 7, _, 9, _, 11, _, 12, _, 11, _, 9, _, 7, _, _, _],
    ] },
    sections: {
      groove: { energy: 0.7, stabs: true, riser: true, drums: { kick: FOUR, ohat: OFF, clap: TWO_FOUR, darbuka: FALLAHI, zill: '..x...x...x...x.' } },
      drop: { energy: 1, stabs: true, lead: true, fills: true, drums: { kick: FOUR, ohat: OFF, hat: SIXTEENTHS, clap: '....x..x....x...', darbuka: FALLAHI, zill: '..x...x...x.x.x.' } },
      break: { energy: 0.35, lead: true, noBass: true, pad: true, riser: true, drums: { clap: TWO_FOUR, zill: '..x...x...x...x.' } },
    },
  },
  {
    name: 'While You Live, Shine',
    subtitle: 'the Seikilos song, deep house mix · 120 bpm',
    note: 'The oldest complete song in the world, carved on a marble column in the 1st century AD with its melody written above the words. The tune here is a loose approximation, played on a lyre over a house beat.',
    bpm: 120, root: 110, scale: MAJOR,
    // A, E, D, A (as scale degrees of A major: 0, 4, 3, 0)
    progression: [0, 4, 3, 0],
    arrangement: ['intro', 'groove', 'drop', 'break', 'drop', 'outro'],
    bass: { type: 'sub', follow: true, pattern: [0, _, _, 0, _, _, _, _, _, _, 0, _, _, _, 4, _], octave: 0 },
    pad: { voicing: [0, 2, 4], octave: 1, cutoff: 1100 },
    sections: {
      intro: { energy: 0.3, pad: true, seikilos: 'lyre', noBass: true, drums: { rim: '...x..x....x..x.' } },
      groove: { energy: 0.6, pad: true, riser: true, drums: { kick: FOUR, hat: OFF, rim: '...x..x....x..x.', shaker: 'x.o.x.o.x.o.x.o.' } },
      drop: { energy: 0.95, pad: true, seikilos: 'bell', drums: { kick: FOUR, hat: OFF, clap: TWO_FOUR, shaker: 'x.o.x.o.x.o.x.o.' } },
      break: { energy: 0.25, pad: true, seikilos: 'lyre', noBass: true, riser: true, drums: {} },
      outro: { energy: 0.4, pad: true, drums: { kick: FOUR, rim: '...x..x....x..x.' } },
    },
  },
];
