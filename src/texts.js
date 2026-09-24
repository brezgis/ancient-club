// Every inscription in the club. All texts are real ancient texts.
//
// Each line is a sequence of stages; pressing E on a line re-carves it into the next stage.
//   hiero    : Manuel-de-Codage-ish sign codes (see glyphs.js)
//   translit : Egyptological transliteration (older ȝ / ʿ convention, which the font supports)
//   greek    : ancient Greek
//   english  : English (my own translations, kept close to the standard scholarly ones)
//
// fidelity tells you how close the hieroglyphs are to the original monument:
//   'attested'      : a standard, well-attested spelling of this exact phrase
//   'reconstructed' : the words are real and attested, but the sign-by-sign spelling
//                     here is my typesetting and may differ from the specific original
//   'original'      : the text is quoted as it appears in the original source (Greek)

export const SLABS = {
  rosetta: {
    title: 'After the Rosetta Stone',
    object: 'Granodiorite stela, 196 BC · British Museum EA 24',
    stone: 'granodiorite',
    pigment: null,
    lines: [
      {
        fidelity: 'attested',
        stages: [
          { script: 'hiero', text: '< Q3:X1 V4 E23 Aa15 M17A S29 S34 I10:X1:N17 Q3:X1 V28 U7 M17 >' },
          { script: 'translit', text: 'ptwlmys ʿnḫ ḏt ptḥ mrj' },
          { script: 'greek', text: 'ΠΤΟΛΕΜΑΙΟΥ ΑΙΩΝΟΒΙΟΥ ΗΓΑΠΗΜΕΝΟΥ ΥΠΟ ΤΟΥ ΦΘΑ' },
          { script: 'english', text: 'Ptolemy, living forever, beloved of Ptah' },
        ],
        note: 'The cartouche that cracked the code. Thomas Young, then Jean-François Champollion (1822), matched this oval to the Greek name ΠΤΟΛΕΜΑΙΟΣ and read p, t, l, m, s as sounds. That was the first proof that hieroglyphs could spell phonetically.',
      },
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'ΒΑΣΙΛΕΥΟΝΤΟΣ ΤΟΥ ΝΕΟΥ ΚΑΙ ΠΑΡΑΛΑΒΟΝΤΟΣ ΤΗΝ ΒΑΣΙΛΕΙΑΝ ΠΑΡΑ ΤΟΥ ΠΑΤΡΟΣ' },
          { script: 'english', text: 'In the reign of the young one, who received the kingship from his father…' },
        ],
        note: 'The first line of the Greek text. The top of the hieroglyphic section is broken away, so this opening survives only in Greek and Demotic. The “young one” is Ptolemy V, crowned at about 13.',
      },
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'ΤΟΙΣ ΤΕ ΙΕΡΟΙΣ ΚΑΙ ΕΓΧΩΡΙΟΙΣ ΚΑΙ ΕΛΛΗΝΙΚΟΙΣ ΓΡΑΜΜΑΣΙΝ' },
          { script: 'english', text: '…in sacred, and native, and Greek letters.' },
        ],
        note: 'The last line of the Greek orders the decree to be carved in three scripts: “sacred” (hieroglyphs), “native” (Demotic), and Greek. The stone announces that it is a parallel text, which is exactly why it could be used to decipher the other two.',
      },
    ],
  },

  harper: {
    title: 'The Harper’s Song',
    object: 'After the “Song from the Tomb of King Intef” (Papyrus Harris 500) and tomb harper songs, New Kingdom',
    stone: 'limestone',
    pigment: '#1c4f9c',
    lines: [
      {
        fidelity: 'attested',
        stages: [
          { script: 'hiero', text: 'D4 O4 D21:G43 N5 F35 I9:D21' },
          { script: 'translit', text: 'jr hrw nfr' },
          { script: 'english', text: 'Make holiday! (lit. “make a good day”)' },
        ],
        note: 'The refrain of the harpers’ songs sung at banquets and painted in tombs: life is short, so celebrate. “hrw nfr”, the good day, also meant a feast day. It is the name of this club.',
      },
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'T18 G17:S29 F34:Z1 V31 E34 N35:N35 V31' },
          { script: 'translit', text: 'šms jb.k wnn.k' },
          { script: 'english', text: 'Follow your heart as long as you live!' },
        ],
        note: 'The Egyptians thought with the heart (jb), not the brain. During mummification the brain was discarded, but the heart was left in the body so it could be weighed against the feather of Maat.',
      },
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'S29 Aa1 G17 Aa1 F34:Z1' },
          { script: 'translit', text: 'sḫmḫ jb' },
          { script: 'english', text: 'Make the heart forget: have fun!' },
        ],
        note: 'sḫmḫ-jb literally means “to make the heart forget”. It was the ordinary Egyptian word for amusing yourself.',
      },
    ],
  },

  glossary: {
    title: 'Words for the Dance Floor',
    object: 'A glossary slab (typeset for this club)',
    stone: 'sandstone',
    pigment: '#8d2a1c',
    lines: [
      {
        fidelity: 'attested',
        stages: [
          { script: 'hiero', text: 'S34 U28 S29' },
          { script: 'translit', text: 'ʿnḫ wḏȝ snb' },
          { script: 'english', text: 'Life! Prosperity! Health!' },
        ],
        note: 'Written after a king’s name and in letters, often abbreviated “l.p.h.” by Egyptologists. The ankh sign on its own means “life”.',
      },
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: '< F35:X1 M18 X1 B1 >' },
          { script: 'translit', text: 'nfrt-jj.tj' },
          { script: 'english', text: 'Nefertiti: “The Beautiful One Has Come”' },
        ],
        note: 'nfr (the lute-like sign 𓄤, actually a heart and windpipe) means beautiful/good. The same word is in Nefertiti and Nefertari, two different queens about 80 years apart.',
      },
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'V28 N35:N29 X1 W22' },
          { script: 'translit', text: 'ḥnqt' },
          { script: 'english', text: 'Beer' },
        ],
        note: 'Thick, nourishing barley or emmer beer was a daily staple, and workers were partly paid in it. The final jug sign is a determinative: silent, it just tells you the word is about drinks.',
      },
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'M17 D21:Q3 W21' },
          { script: 'translit', text: 'jrp' },
          { script: 'english', text: 'Wine' },
        ],
        note: 'Wine was a luxury for the elite. Jars were labelled like modern bottles, with the year, the estate, and the chief vintner.',
      },
    ],
  },

  offering: {
    title: 'The Oldest Menu',
    object: 'The offering formula (ḥtp-dj-nsw), found on countless stelae and tombs',
    stone: 'limestone',
    pigment: '#1c4f9c',
    lines: [
      {
        fidelity: 'attested',
        stages: [
          { script: 'hiero', text: 'M23 X1:R4 X8 Q1 D4 A40' },
          { script: 'translit', text: 'ḥtp-dj-nsw wsjr' },
          { script: 'english', text: 'An offering which the king gives to Osiris…' },
        ],
        note: 'The most common sentence in Egyptian. Notice that “king” (nsw, the sedge plant 𓇓) is written first even though it is read later. This is honorific transposition: important words go first.',
      },
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'D37:I9 O3 X2*W22 F1 G54' },
          { script: 'translit', text: 'dj.f prt-ḫrw t ḥnqt kȝ ȝpd' },
          { script: 'english', text: '…that he may give a voice-offering of bread, beer, oxen and fowl…' },
        ],
        note: 'prt-ḫrw means “going forth of the voice”. Just reading the menu aloud made the food real for the dead, so every visitor who reads this line feeds its owner. You just did.',
      },
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'V6 S27 Aa1:X1*M3 V30:X1 F35:X1 D60:X1' },
          { script: 'translit', text: 'šs mnḫt ḫt nbt nfrt wʿbt' },
          { script: 'english', text: '…alabaster, linen, and every good and pure thing.' },
        ],
        note: 'The formula continues “…on which a god lives, for the ka of” the owner. The ka was the life-force, and it needed feeding.',
      },
    ],
  },

  hathor: {
    title: 'Lady of Drunkenness',
    object: 'Epithets of Hathor (typeset for this club)',
    stone: 'sandstone',
    pigment: '#8d2a1c',
    lines: [
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'O10 V30:X1 X1:Aa1 W22' },
          { script: 'translit', text: 'ḥwt-ḥr nbt tḫ' },
          { script: 'english', text: 'Hathor, Lady of Drunkenness' },
        ],
        note: 'A real epithet. In the myth of the Destruction of Mankind, the sun god stopped his raging Eye (Sekhmet) by flooding the fields with beer dyed red with ochre. She thought it was blood, drank it, got drunk, and forgot to destroy humanity. Hathor’s “Festival of Drunkenness” celebrated this.',
      },
      {
        fidelity: 'attested',
        stages: [
          { script: 'hiero', text: 'O10' },
          { script: 'translit', text: 'ḥwt-ḥr' },
          { script: 'greek', text: 'Ἀφροδίτη' },
          { script: 'english', text: 'Hathor (“House of Horus”), whom the Greeks called Aphrodite' },
        ],
        note: 'The sign is a falcon (Horus) inside a building: Ḥwt-Ḥr, “House of Horus”. Greek visitors identified Hathor with Aphrodite, goddess of love, music, and dance.',
      },
    ],
  },

  alcaeus: {
    title: 'Drinking Songs of Alcaeus',
    object: 'Alcaeus of Lesbos, c. 600 BC, fragments 332, 346, 366, 333 (Voigt)',
    stone: 'marble',
    pigment: '#2a2018',
    lines: [
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'νῦν χρῆ μεθύσθην καί τινα πρὸς βίαν πώνην, ἐπεὶ δὴ κάτθανε Μύρσιλος' },
          { script: 'english', text: 'Now we must get drunk, and drink with all our might, because Myrsilus is dead!' },
        ],
        note: 'Alcaeus celebrating the death of Myrsilus, tyrant of Mytilene. Horace later imitated it in Latin: “nunc est bibendum”.',
      },
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'πώνωμεν· τί τὰ λύχν᾽ ὀμμένομεν; δάκτυλος ἀμέρα' },
          { script: 'english', text: 'Let’s drink! Why wait for the lamps? There’s a finger’s breadth of day left.' },
        ],
        note: 'Written in the Aeolic dialect of Lesbos: ἀμέρα for Attic ἡμέρα, ὀμμένομεν for ἀναμένομεν.',
      },
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'οἶνος, ὦ φίλε παῖ, καὶ ἀλάθεα' },
          { script: 'english', text: 'Wine, dear boy, and truth.' },
        ],
        note: 'The ancestor of the Latin proverb “in vino veritas”.',
      },
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'οἶνος γὰρ ἀνθρώποις δίοπτρον' },
          { script: 'english', text: 'For wine is a window into a person.' },
        ],
        note: 'δίοπτρον means something you look through: a spyhole or a lens.',
      },
    ],
  },

  seikilos: {
    title: 'The Song of Seikilos',
    object: 'Marble funerary column, 1st c. AD, from near Aydın, Turkey · National Museum of Denmark',
    stone: 'marble',
    pigment: '#2a2018',
    music: 'seikilos',
    lines: [
      { fidelity: 'original', stages: [{ script: 'greek', text: 'ὅσον ζῇς φαίνου' }, { script: 'english', text: 'While you live, shine;' }] },
      { fidelity: 'original', stages: [{ script: 'greek', text: 'μηδὲν ὅλως σὺ λυποῦ' }, { script: 'english', text: 'let nothing grieve you at all.' }] },
      { fidelity: 'original', stages: [{ script: 'greek', text: 'πρὸς ὀλίγον ἐστὶ τὸ ζῆν' }, { script: 'english', text: 'Life is only for a little while,' }] },
      { fidelity: 'original', stages: [{ script: 'greek', text: 'τὸ τέλος ὁ χρόνος ἀπαιτεῖ' }, { script: 'english', text: 'and time demands its due.' }] },
    ].map(l => ({ ...l, note: 'The oldest complete surviving song in the world. Its melody is notated in Greek letter-signs above the words. Translate a line and a lyre plays a loose approximation of the tune.' })),
  },

  // --- the bathroom ---------------------------------------------------------
  mirror: {
    title: 'Mirror, Mirror',
    object: 'Bathroom mirror graffiti',
    stone: 'plaster',
    pigment: '#b8323c',
    lines: [
      {
        fidelity: 'attested',
        stages: [
          { script: 'hiero', text: 'F35 D2:Z1' },
          { script: 'translit', text: 'nfr ḥr' },
          { script: 'english', text: 'Beautiful of face' },
        ],
        note: 'A divine and royal epithet (Ptah is “beautiful of face”). The sign 𓁷 is a face seen from the front, which is rare in a script that draws nearly everything in profile.',
      },
      {
        fidelity: 'attested',
        stages: [
          { script: 'hiero', text: 'S34' },
          { script: 'translit', text: 'ʿnḫ' },
          { script: 'english', text: '“Life”, and also… “mirror”' },
        ],
        note: 'ʿnḫ, the ankh, was also the word for a hand mirror, and mirror cases were sometimes made in the shape of an ankh. Egyptian mirrors were polished bronze or copper discs.',
      },
    ],
  },

  sappho: {
    title: 'Sappho on the Stall Door',
    object: 'Sappho fr. 2 (from a 3rd-c. BC potsherd found in Egypt) and fr. 31, plus a Valley of the Kings graffito',
    stone: 'plaster',
    pigment: '#6b2b6b',
    lines: [
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'χρυσίαισιν ἐν κυλίκεσσιν ἄβρως' },
          { script: 'english', text: 'into golden cups, gracefully,' },
        ],
        note: 'Sappho fr. 2 is a prayer asking Aphrodite to come and be wine-pourer at the feast. It survives on an ostracon (potsherd) found in Egypt, copied out around 1,000 kilometres from Lesbos.',
      },
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'ὀμμεμείχμενον θαλίαισι νέκταρ οἰνοχόαισον' },
          { script: 'english', text: 'pour out nectar mingled with our festivities.' },
        ],
        note: 'θαλίαι are festivities or good cheer. The nectar of the gods is mixed with the party itself.',
      },
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'φαίνεταί μοι κῆνος ἴσος θέοισιν ἔμμεν᾽ ὤνηρ' },
          { script: 'english', text: 'He seems to me equal to the gods, that man…' },
        ],
        note: 'The opening of Sappho fr. 31: the man “who sits opposite you and listens close to your sweet voice”. It is preserved because the treatise “On the Sublime” quotes it as a model of passion.',
      },
      {
        fidelity: 'original',
        stages: [
          { script: 'greek', text: 'ἰδὼν ἐθαύμασα' },
          { script: 'english', text: 'I saw it and I was amazed.' },
        ],
        note: 'A formula scratched by Greek and Roman tourists in the royal tombs of the Valley of the Kings. There are over two thousand such graffiti. Ancient bathroom-wall energy.',
      },
    ],
  },

  lovesong: {
    title: 'A Love Song',
    object: 'After Papyrus Chester Beatty I, 20th Dynasty (c. 1150 BC)',
    stone: 'plaster',
    pigment: '#1c4f9c',
    lines: [
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'G43 D36:X1 T22:N35 X1 B1 D35:N35 T22:N35:N35 G43 S29' },
          { script: 'translit', text: 'wʿt snt nn snnw.s' },
          { script: 'english', text: 'The One, the sister without equal,' },
        ],
        note: 'In Egyptian love poetry lovers call each other “sister” and “brother” (snt, sn), meaning “beloved”, not siblings. This poem is written in hieratic, a cursive form of hieroglyphs. The signs here are a standard transcription style, not a copy.',
      },
    ],
  },

  // --- door signs -----------------------------------------------------------
  doorWomen: {
    title: 'Ladies',
    object: 'Door sign',
    stone: 'limestone',
    pigment: '#8d2a1c',
    compact: true,
    lines: [
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'N41:X1 B1 Z2' },
          { script: 'translit', text: 'ḥmwt' },
          { script: 'english', text: 'Women' },
        ],
        note: 'The seated woman 𓁐 (B1) is the determinative for women and female names. It is silent and only tells you what kind of word it is. The three strokes mark the plural.',
      },
    ],
  },
  doorMen: {
    title: 'Gents',
    object: 'Door sign',
    stone: 'limestone',
    pigment: '#1c4f9c',
    compact: true,
    lines: [
      {
        fidelity: 'reconstructed',
        stages: [
          { script: 'hiero', text: 'O34 A1 Z2' },
          { script: 'translit', text: 's(w)' },
          { script: 'english', text: 'Men · closed for renovation since the 19th Dynasty' },
        ],
        note: 'The seated man 𓀀 (A1) is the determinative for men, and in texts it can also mean “I”.',
      },
    ],
  },

  clubSign: {
    title: 'Heru-Nefer',
    object: 'Over the bar',
    stone: 'gold',
    pigment: null,
    compact: true,
    lines: [
      {
        fidelity: 'attested',
        stages: [
          { script: 'hiero', text: 'O4 D21:G43 N5 F35 I9:D21' },
          { script: 'translit', text: 'hrw nfr' },
          { script: 'english', text: 'Club Heru-Nefer · “The Good Day”' },
        ],
        note: '“hrw nfr” (a good day) was what Egyptians called a holiday or feast day.',
      },
    ],
  },
};
