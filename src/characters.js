// Who's who in the club, and what they have to say.
// A character is { name, subtitle, start, nodes: { id: { text, options: [{ label, to?, action? }] } } }.
// text may be a function of the game state.

export const WORDS = [
  ['nfr', '𓄤', 'beautiful, good', 'It’s the first part of my name. It’s also in “Nefertari”, whom everyone confuses me with.'],
  ['ʿnḫ', '𓋹', 'life, and also mirror', 'Try saying it to the girls in the bathroom.'],
  ['jb', '𓄣', 'heart, mind', '“Follow your heart” was an ancient instruction long before it was a greeting card.'],
  ['ḥnqt', '𓎛𓈖𓈎𓏏𓏊', 'beer', 'Ask the barkeep. Ask him politely.'],
  ['snb', '𓋴𓈖𓃀', 'healthy, be well', 'Letters often opened by wishing the reader well, and it was also a way to say goodbye.'],
  ['sbȝ', '𓇼', 'star, and also to teach', 'The same five-pointed star is written in “school” and in “teaching”. Look up at the ceiling: that’s a classroom.'],
];

const BYE = { label: 'Snb! (Be well!)', to: null };

export const NEFERTITI = {
  name: 'Nefertiti',
  subtitle: 'Great Royal Wife of Akhenaten · c. 1370–1330 BC',
  start: 'hello',
  nodes: {
    hello: {
      text: (st) => st.metNefertiti
        ? 'Back already? My shoulders are still moving. Go on, ask.'
        : 'Ah, a guest who walks on two legs and is not made of limestone. Welcome to the Good Day. I am Nefertiti: Great Royal Wife, Lady of the Two Lands, Mistress of Upper and Lower Egypt. At least my head and shoulders are.',
      onEnter: (st) => { st.metNefertiti = true; },
      options: [
        { label: 'Wait… aren’t you Nefertari?', to: 'nefertari' },
        { label: 'Tell me about yourself.', to: 'about' },
        { label: 'Teach me a word.', to: 'word' },
        { label: 'Dance with me!', action: 'dance' },
        BYE,
      ],
    },
    about: {
      text: 'Where shall I start? I have three thousand years of material.',
      options: [
        { label: 'What happened to your left eye?', to: 'eye' },
        { label: 'The sun disk, and your husband.', to: 'aten' },
        { label: 'Did you ever rule Egypt yourself?', to: 'pharaoh' },
        { label: 'Why are you in a nightclub?', to: 'club' },
        { label: 'Back.', to: 'hello' },
      ],
    },
    nefertari: {
      text: 'Everyone does this! Nefertari was Great Royal Wife of Ramesses II, roughly eighty years after me. Her tomb in the Valley of the Queens (QV66) is painted so beautifully that people call it the Sistine Chapel of Egypt. Both our names start with nfr, “beautiful”. Hers, Nefertari, means “beautiful companion”. Mine, Nefertiti, means “the beautiful one has come”. She got the painted tomb and I got the famous face. We’re even.',
      options: [
        { label: 'Where is your tomb?', to: 'tomb' },
        { label: 'Back to the dance floor chat.', to: 'hello' },
      ],
    },
    tomb: {
      text: 'Nobody knows. Truly. My burial has never been securely identified. There are theories about hidden chambers, and about unidentified mummies. Let them wonder. I spent my life being looked at, and I’d like my afterlife private.',
      options: [{ label: 'Fair enough.', to: 'about' }],
    },
    eye: {
      text: 'Rude. But fair. My right eye is an inlay of quartz, with the pupil painted black and set in beeswax. The left was never inlaid. The excavators searched the rubble for it and found nothing. I was probably a workshop model: I was found on 6 December 1912 in the house of the sculptor Thutmose at Amarna, by Ludwig Borchardt’s team. A master copy, if you like. Masters don’t need two eyes.',
      options: [
        { label: 'And now you live in Berlin?', to: 'berlin' },
        { label: 'Back.', to: 'about' },
      ],
    },
    berlin: {
      text: 'In the Neues Museum, in a room of my own. How I got there is disputed. The division of finds in 1913 gave me to the German excavators, and Egypt has asked for me back many times since the 1920s. In 2016 two artists claimed they had secretly scanned me. In 2019 the museum’s own scan was finally released to the public after a freedom-of-information campaign. That is how a copy of me can be dancing here tonight.',
      options: [{ label: 'Back.', to: 'hello' }],
    },
    aten: {
      text: 'My husband Akhenaten decided there should be one god above all: the Aten, the disk of the sun, drawn with rays that end in little hands giving the ankh of life to us, and only to us. We built a new city in the desert, Akhetaten, “Horizon of the Aten”. You call it Amarna. The art changed too: long faces, soft bellies, a royal family kissing its children. After we died they tore it all down, and my son-in-law Tutankhaten became Tutankhamun.',
      options: [
        { label: 'Your son-in-law?', to: 'tut' },
        { label: 'Back.', to: 'about' },
      ],
    },
    tut: {
      text: 'My daughter Ankhesenpaaten married him, and became Ankhesenamun when the old gods came back. I had six daughters. No sons, whatever the gossips say. The boy was probably Akhenaten’s son by another woman, and DNA studies point to a lady called “the Younger Lady”. Families. Even three thousand years later.',
      options: [{ label: 'Back.', to: 'hello' }],
    },
    pharaoh: {
      text: 'Hmm. Carved blocks show me smiting enemies with a mace, a pose normally reserved for kings. And after my husband, a mysterious ruler called Neferneferuaten reigned for a while. Some scholars think that was me. Others think it wasn’t. I am a queen, darling. I don’t have to tell you.',
      options: [{ label: 'That is so power.', to: 'about' }],
    },
    word: {
      text: (st) => {
        const i = (st.wordIndex = ((st.wordIndex ?? -1) + 1) % WORDS.length);
        const [tr, glyph, meaning, quip] = WORDS[i];
        st.learned ??= new Set();
        st.learned.add(tr);
        return `<span class="big-glyph">${glyph}</span> <i>${tr}</i> means “${meaning}”. ${quip}`;
      },
      options: [
        { label: 'Another!', to: 'word' },
        { label: 'Back.', to: 'hello' },
      ],
    },
    club: {
      text: 'Where else should I be? Egyptians loved a party. There were banquets with harpists and dancers, and festivals where whole cities got drunk for the gods. At Hathor’s Festival of Drunkenness you were supposed to pass out and be woken by drums to see the goddess. Also, I’m technically on loan. Don’t tell Berlin.',
      options: [{ label: 'Back.', to: 'about' }],
    },
  },
};

export const MENU = [
  { id: 'henqet', name: 'Ḥenqet', desc: 'barley beer, cloudy & nourishing', price: 1, drunk: 1,
    fact: 'Beer was food. Workers on royal projects were issued bread and beer as part of their rations, and a shared jug was a basic part of daily life.' },
  { id: 'irp', name: 'Jrp: Delta red', desc: 'wine, labelled like a Pharaoh’s', price: 3, drunk: 1.4,
    fact: 'Tutankhamun was buried with about two dozen jars of wine, labelled like modern bottles with the regnal year, the estate, and the chief vintner.' },
  { id: 'shedeh', name: 'Shedeh', desc: 'the prestige pour', price: 5, drunk: 1.8,
    fact: 'Shedeh was the most precious drink in Egypt, and for a long time no one knew what it was. A 2006 chemical analysis of a jar from Tutankhamun’s tomb showed it was made from red grapes.' },
  { id: 'lotus', name: 'Blue-lotus spritz', desc: 'wine with a floating blue water-lily', price: 4, drunk: 1.2,
    fact: 'Banquet paintings show guests holding and sniffing blue water-lilies (Nymphaea caerulea). Whether the flower was mildly narcotic is still debated.' },
  { id: 'sekhmet', name: 'Sekhmet’s Red', desc: 'beer, dyed with red ochre · on the house', price: 0, drunk: 2,
    fact: 'In the myth, Ra saved humanity by flooding the fields with 7,000 jars of beer dyed red with ochre. The raging Sekhmet drank it, thinking it was blood, and fell asleep drunk.' },
  { id: 'water', name: 'Nile water', desc: 'free, flood-fresh', price: 0, drunk: -1.5,
    fact: 'Herodotus called Egypt “the gift of the river”. Every year the flood laid down fresh black silt, and the Egyptians named their land after it: Kemet, “the Black Land”.' },
];

export function makeBartender(info) {
  const who = info?.who ?? info?.title ?? 'a limestone servant statue';
  return {
    name: info?.displayName ?? 'The Barkeep',
    subtitle: info ? `${info.title}${info.museum ? ' · ' + info.museum : ''}` : 'Statue, off duty from eternity',
    start: 'hello',
    nodes: {
      hello: {
        text: (st) => st.drinks >= 6
          ? 'Whoa. Six drinks. The lady in the tomb of Paheri asked for eighteen cups of wine, but she was painted, and you’re not. Have some Nile water.'
          : `Welcome to the bar at the Good Day. Normally I’m ${who}, but tonight I pour. We take deben, a weight of copper of about 91 grams. You have ${st.deben} deben. What’ll it be?`,
        options: [
          { label: 'Show me the menu.', to: 'menu' },
          { label: 'How did money work without coins?', to: 'money' },
          BYE,
        ],
      },
      menu: {
        text: (st) => `Everything is priced in deben of copper. You have <b>${st.deben}</b>.`,
        options: (st) => [
          ...MENU.map(m => ({
            label: `<b>${m.name}</b> <span class="opt-sub">${m.desc}${m.price ? ` · ${m.price} deben` : ''}</span>`,
            action: `buy:${m.id}`,
            disabled: m.price > st.deben,
          })),
          { label: 'Back.', to: 'hello' },
        ],
      },
      money: {
        text: 'For most of pharaonic history there were no coins. Prices were expressed in deben of copper, or in grain or silver, but people mostly bartered: a coffin for a goat, some sandals, and a jar of fat, all totted up in deben. Coins only really arrived with the Greeks. Don’t worry, I’ll run you a tab in eternity.',
        options: [{ label: 'Back to the menu.', to: 'menu' }],
      },
      served: {
        text: (st) => `${st.lastServed.name}, coming up. ${st.lastServed.fact}`,
        options: [{ label: 'Another round?', to: 'menu' }, BYE],
      },
      broke: {
        text: 'You’re out of deben. Sekhmet’s Red is on the house, and so is the Nile. Or go and translate something. Knowledge is the only currency the gods respect.',
        options: [{ label: 'Back.', to: 'hello' }],
      },
    },
  };
}

// Dance-floor statues: quips drawn from their museum records plus some shared silliness.
const DANCE_QUIPS = [
  'I stood perfectly still for three thousand years. Let me have this.',
  'Egyptian statues were made to hold a ka, a spirit. Mine really likes this song.',
  'Most statues were painted once. Under these lights I remember what colour felt like.',
  'Stone doesn’t sweat. Stone doesn’t stop.',
  'Careful. I’m granite, and if I step on your foot it’s for eternity.',
  'Egyptian art shows the body from its most recognisable angles: face in profile, eye from the front, shoulders from the front. I dance the same way.',
];

export function makeDancer(info, i) {
  const facts = info?.facts?.length ? info.facts : [];
  const name = info?.displayName ?? info?.title ?? 'Dancing Statue';
  return {
    name,
    subtitle: [info?.date, info?.museum, info?.accession_number].filter(Boolean).join(' · ') || 'Statue',
    start: 'hello',
    nodes: {
      hello: {
        text: () => {
          const pool = [...facts.map(f => `(still dancing) ${f}`), ...DANCE_QUIPS];
          return pool[Math.floor(Math.random() * pool.length)];
        },
        options: [
          ...(facts.length ? [{ label: 'Who are you, really?', to: 'who' }] : []),
          { label: 'Nice moves.', to: 'moves' },
          BYE,
        ],
      },
      who: {
        text: () => `${info.title}. ${[info.material, info.date, info.museum && `now in ${info.museum}`].filter(Boolean).join(', ')}. ${facts.join(' ')}${info.license ? ` (My 3D scan: ${info.license}${info.attribution ? ', ' + info.attribution : ''}.)` : ''}`,
        options: [{ label: 'Back.', to: 'hello' }, BYE],
      },
      moves: {
        text: ['I call this one “The Weighing of the Heart”: lean left, lean right, and hope you balance against the feather.',
          'This one is “Crossing the Nile”: you hop, because of the crocodiles.',
          'It’s called “The Solar Barque”. You spin slowly all night and come up in the east.'][i % 3],
        options: [{ label: 'Back.', to: 'hello' }, BYE],
      },
    },
  };
}

// The girls in the bathroom
const BATH_LINES = [
  {
    text: 'Give me eighteen cups of wine! I want to drink until I’m drunk, my insides are as dry as straw!',
    cite: 'This is (nearly) what a banqueting lady says in a painted speech caption in the tomb of Paheri at Elkab, 18th Dynasty. Tomb paintings have speech bubbles, basically.',
  },
  {
    text: 'Is my kohl smudged? Kohl isn’t just pretty. A 2010 study suggested the lead compounds in Egyptian eye make-up may have helped the eyes fight infection. Beauty is medicine, babe.',
    cite: 'Kohl was made from minerals like galena (lead sulphide) and worn by women and men alike.',
  },
  {
    text: 'You know the cones on people’s heads in banquet paintings? Everyone said they were just symbolic. Then in 2019 archaeologists reported actual head cones found on burials at Amarna. We were right all along.',
    cite: 'Whether they were perfumed wax that melted, or purely symbolic, is still debated.',
  },
  {
    text: 'This is a wig, obviously. Human hair, beeswax, very fashionable. Under it I’m basically bald. Cooler, cleaner, no lice. Try it.',
    cite: 'Elite Egyptians often wore elaborate wigs, and wig-making was a skilled craft.',
  },
  {
    text: 'Read the stall door, it’s Sappho! Someone copied her poem onto a pot in Egypt three hundred years after she wrote it. Girls have been writing poetry on things in bathrooms forever.',
    cite: 'The Sappho fr. 2 ostracon is in Florence (PSI XIII 1300).',
  },
  {
    text: 'He calls me his “sister”. That’s romantic, it means “beloved”. It is NOT weird, it’s just Egyptian.',
    cite: 'In love poetry snt, “sister”, and sn, “brother”, are terms of endearment.',
  },
  {
    text: 'Hold my ankh. No, my mirror. Same word. ʿnḫ.',
    cite: 'The word ʿnḫ meant both “life” and “mirror”.',
  },
];

export function makeBathGirl(info, i) {
  const name = info?.displayName ?? info?.title ?? ['A Tipsy Queen', 'A Lady of the House', 'A Goddess, Off Duty', 'A Banquet Guest'][i % 4];
  let k = i * 2;
  return {
    name,
    subtitle: [info?.title !== name ? info?.title : null, info?.museum].filter(Boolean).join(' · ') || 'Statue, freshening up',
    start: 'hello',
    nodes: {
      hello: {
        text: () => {
          const l = BATH_LINES[k++ % BATH_LINES.length];
          return `“${l.text}”<div class="cite">${l.cite}</div>`;
        },
        options: [
          { label: 'Tell me more!', to: 'hello' },
          ...(info?.facts?.length ? [{ label: 'Who are you?', to: 'who' }] : []),
          { label: 'You look beautiful. Nfr ḥr!', to: 'compliment' },
          BYE,
        ],
      },
      who: {
        text: () => `${info.title}. ${info.facts.join(' ')}`,
        options: [{ label: 'Back.', to: 'hello' }],
      },
      compliment: {
        text: 'Nfr ḥr! “Beautiful of face!” Stop it, you’re sweet. You look beautiful too, and that’s not the wine talking. Well. It’s partly the wine.',
        options: [{ label: 'Back.', to: 'hello' }, BYE],
      },
    },
  };
}

export function makeDJ(info) {
  return {
    name: 'Hapi, Scribe & DJ',
    subtitle: info ? `${info.title} · 3D scan ${info.license}` : 'Scribe, on the decks',
    start: 'hello',
    nodes: {
      hello: {
        text: 'Hapi, scribe. I sit cross-legged because that is how scribes worked: with the kilt pulled tight across the knees, your lap is a desk. Tonight the papyrus is a playlist.',
        options: [
          { label: 'What’s this track?', to: 'track' },
          { label: 'Next track, please!', action: 'nextTrack', to: 'next' },
          { label: 'What did ancient Egyptian music sound like?', to: 'ancient' },
          { label: 'Should I become a scribe?', to: 'scribe' },
          BYE,
        ],
      },
      track: {
        text: (st) => st.track ? `<b>${st.track.name}</b> <span class="opt-sub">${st.track.subtitle}</span><br>${st.track.note}` : 'Silence, for now. Click to start the music!',
        options: [{ label: 'But is any of this authentic?', to: 'music' }, { label: 'Back.', to: 'hello' }],
      },
      next: {
        text: 'Say no more. I’ll mix it in at the top of the next bar.',
        options: [{ label: 'What’s next?', to: 'track' }, BYE],
      },
      music: {
        text: 'Honestly? Mostly anachronisms. The scales are maqamat like hijaz, from much later Arabic music. The darbuka rhythms (maqsum, saidi, fallahi) are modern Egyptian. The four-on-the-floor kick is Chicago, 1980s. What is genuinely ancient: the sistrum shimmer, the finger cymbals, the lyre, and the Seikilos tune. The sistrum was Hathor’s own rattle, shaken in her temples.',
        options: [{ label: 'Back.', to: 'hello' }],
      },
      ancient: {
        text: 'Nobody knows, and that’s the heartbreak. We have the instruments: harps, lutes, lyres, double oboes, clappers, sistra. We have paintings of musicians, and even hand gestures that may be conducting. But no Egyptian music notation has ever been deciphered. The Greeks did write their melodies down, which is why the Seikilos song on that column survives complete.',
        options: [{ label: 'Play the Seikilos song!', action: 'seikilos', to: 'seikilos' }, { label: 'Back.', to: 'hello' }],
      },
      seikilos: {
        text: '“While you live, shine.” Seikilos had this carved on a column for someone, perhaps his wife, about two thousand years ago. It’s the oldest complete song we have. My lyre version is only a loose approximation. Translate the column yourself to read all four lines.',
        options: [{ label: 'Back.', to: 'hello' }, BYE],
      },
      scribe: {
        text: '“Be a scribe! It saves you from toil and protects you from all kinds of labour.” That’s real advice from Egyptian school texts, which spend pages mocking every other job: the smelly fisherman, the exhausted farmer, the washerman. Very few Egyptians could read, and writing was power. Also, you get to sit down.',
        options: [{ label: 'Back.', to: 'hello' }],
      },
    },
  };
}
