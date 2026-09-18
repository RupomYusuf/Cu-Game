/* ============ Game content ============ */
const DATA = {};

/* --- Conversation cards --- */
DATA.decks = {
  warm: {
    name: 'Warm-up ☀️',
    cards: [
      "What was your very first impression of me?",
      "What's a small thing I do that always makes you smile?",
      "What's your favorite memory of us so far?",
      "If we could teleport anywhere for a date tomorrow, where would we go?",
      "What song always reminds you of me?",
      "What's something you're looking forward to with us this year?",
      "What's the most thoughtful thing I've ever done for you?",
      "Describe our perfect lazy Sunday together.",
      "What's a food you want us to try together?",
      "What do you think is our cutest couple habit?",
      "What was the funniest moment we've shared?",
      "If you had to pick one photo of us as your favorite, which one and why?",
      "What's a tradition you'd like us to start together?",
      "What's something new you'd like us to learn together?",
      "Where were you the first time you thought 'I really like this person'?",
    ]
  },
  deep: {
    name: 'Deep dive 🌊',
    cards: [
      "When did you last feel most loved by me, and what made it feel that way?",
      "What's a fear about the future you haven't told me yet?",
      "What does 'home' mean to you?",
      "What's something you're working on becoming better at, and how can I support you?",
      "What's a dream you had as a kid that still matters to you?",
      "When you're having a bad day, what do you actually need from me — advice, space, or a hug?",
      "What's a moment in your life that quietly shaped who you are?",
      "What's something you wish I asked you about more often?",
      "How do you want us to handle it when we argue — what feels safe for you?",
      "What's a way I've changed you for the better?",
      "What part of yourself are you most proud of that I might not know you value?",
      "If you could relive one day of your life, which would it be?",
      "What does forgiveness look like to you?",
      "What do you hope we're like together in 10 years?",
      "What's something you've never said out loud to anyone before me?",
      "When do you feel most understood by me?",
      "What legacy do you want your life to leave?",
      "What's the hardest thing you've ever had to let go of?",
    ]
  },
  playful: {
    name: 'Playful 💫',
    cards: [
      "Dare: text me a compliment right now — I get to read it out loud.",
      "Truth: what's the most embarrassing thing you've done to get my attention?",
      "Dare: serenade me for 15 seconds. Any song. Go.",
      "Truth: what's your guilty-pleasure song that I don't know about?",
      "Dare: do your best impression of me.",
      "Truth: if we swapped bodies for a day, what's the first thing you'd do?",
      "Dare: recreate our first date photo pose right now.",
      "Truth: what's the weirdest thing you find attractive about me?",
      "Dare: let me post a caption of my choice on your story (with your photo).",
      "Truth: what rumor would you want spread about us, even if it wasn't true?",
      "Dare: whisper something sweet in my accent... of my choice.",
      "Truth: what's a nickname you secretly want me to use more?",
      "Dare: slow dance with me to one full chorus. Right now.",
      "Truth: what would our rom-com movie be called?",
    ]
  }
};

/* --- Intimate section (18+, consent-gated) --- */
DATA.intimate = {
  soft: {
    name: 'Intimate 💋',
    cards: [
      "What's your favorite memory of us being close?",
      "Describe your idea of a perfect night alone with me.",
      "What do you think about when we kiss?",
      "Rate our last kiss out of 10 — and tell me what would make it an 11.",
      "What's the most attractive thing I do without realizing it?",
      "Where do you love being touched the most? Show me.",
      "Truth: when did you last think about me in a not-so-innocent way?",
      "Dare: give me a 30-second kiss. No talking allowed.",
      "Dare: slow dance with me in the dark to one whole song.",
      "What's something new you'd love for us to try together?",
      "Pick a spot and give me a 5-minute massage. No skipping.",
      "What compliment about my body do you think I need to hear more often?",
      "Lights on or off — and why?",
      "What's something you've wanted to whisper to me but never have?",
      "Dare: trail three kisses wherever you like.",
      "What does seduction look like, from you to me?",
      "Truth: what's your favorite part of being close with me?",
      "If tonight were our last night together for a whole month, how would we spend it?",
      "What sound, scent or sight of mine puts you in the mood?",
      "Truth: tell me about a moment under the covers with me you replay in your head.",
      "Dare: kiss me like it's the first time, all over again.",
      "What could I do tomorrow to make you feel truly desired?",
      "What's the sexiest thing about our relationship that has nothing to do with looks?",
      "Truth: what outfit of mine is your weakness?",
      "Dare: give me a compliment that would make me blush, then prove you meant it.",
      "What's one way we could make our intimate life feel more special?",
    ]
  },
  extreme: {
    name: 'Extremely Intimate 🔥',
    cards: [
      "Truth: describe exactly what you want me to do to you tonight.",
      "Dare: take off one item of clothing — my choice which one.",
      "Truth: what's a fantasy you've never told anyone?",
      "Dare: I pick where the next three kisses go. No negotiating.",
      "Truth: tell me your favorite thing I do to you in bed.",
      "Dare: slow dance for me to one song… and take something off when the chorus hits.",
      "Truth: where's the riskiest place you'd want to make out with me?",
      "Dare: let me blindfold you for the next three cards.",
      "Truth: what sound do I make that drives you the craziest?",
      "Dare: sit skin-to-skin for the rest of this deck. No clothes between us where it counts.",
      "Truth: tell me about the last time we made love — from your point of view.",
      "Dare: kiss me slowly for one full minute. Hands allowed anywhere.",
      "Truth: what would you whisper in my ear right now if no one could ever hear?",
      "Dare: write me a morning text for tomorrow — the kind that makes me cancel my plans.",
      "Truth: what's something you've been shy to ask for in bed? Ask now.",
      "Dare: reenact the most passionate kiss from any movie. Make it convincing.",
      "Truth: rank them — kisses, massages, teasing. What can you never get enough of?",
      "Dare: for every card either of us skips from now on, we each remove one piece of clothing.",
      "Truth: which moment of our intimacy makes you feel closest to me?",
      "Dare: put my hand exactly where you want it — then tell me why.",
      "Truth: what do you think about me that you'd normally never say out loud?",
      "Dare: pick a song and give me a private show. I'll judge with tips.",
      "Truth: tell me exactly how you want tonight to end.",
      "Dare: trade massages… and let the hands wander wherever they want.",
    ]
  }
};

/* --- Who's more likely --- */
DATA.likely = [
  "…plan the whole trip down to the minute?",
  "…cry at a movie's happy ending?",
  "…get lost even with GPS on?",
  "…spend way too long choosing what to watch?",
  "…apologize first after an argument?",
  "…survive longest in the wilderness?",
  "…become internet-famous by accident?",
  "…forget where they put their keys?",
  "…talk to a stranger on a plane for 3 hours?",
  "…adopt a stray animal without asking?",
  "…finish an entire pizza alone at midnight?",
  "…sing loudly in the shower?",
  "…be the first to say 'I love you' to a pet?",
  "…laugh at the wrong moment?",
  "…win a karaoke night?",
  "…accidentally send a text to the wrong person?",
  "…become a workaholic?",
  "…move to another country on a whim?",
  "…know the way to anywhere without a map?",
  "…buy something ridiculous online at 2am?",
  "…be the party animal at a wedding?",
  "…remember every anniversary and detail?",
  "…survive a horror movie without hiding behind the other?",
  "…eat the last snack and blame someone else?",
  "…fall asleep during a movie?",
  "…get competitive playing board games?",
  "…make friends with the waiter?",
  "…plan a surprise that stays a secret?",
  "…win 'The Bachelor/Bachelorette' season?",
  "…start dancing in public for fun?",
  "…spend hours watching cooking videos but never cook?",
  "…be the first one up in the morning?",
  "…send the most good-morning texts?",
  "…accidentally like an old photo while stalking?",
  "…take charge in an emergency?",
  "…give the best pep talks?",
  "…become a fitness guru overnight?",
  "…get starstruck meeting someone famous?",
  "…turn a tiny injury into a huge story?",
  "…be the romantic one who plans Valentine's?",
];

/* --- Pictionary words --- */
DATA.words = [
  // easy
  "heart", "cat", "sun", "fish", "house", "tree", "star", "moon", "cup", "hat",
  "car", "flower", "smile", "pizza", "guitar", "clock", "book", "apple", "bee", "duck",
  // medium
  "wedding", "airplane", "backpack", "candle", "dragon", "elephant", "fireworks", "snowman",
  "telescope", "umbrella", "volcano", "waterfall", "octopus", "penguin", "lighthouse",
  "mermaid", "rainbow", "spaceship", "tornado", "cupcake", "balloon", "castle", "pirate",
  // couple-flavored
  "first date", "love letter", "proposal", "slow dance", "honeymoon", "movie night",
  "piggyback ride", "couple selfie", "anniversary", "picnic", "stargazing", "hug",
  // hard
  "gravity", "time zone", "deja vu", "jet lag", "stage fright", "brainstorm",
  "shadow", "echo", "tug of war", "sleepwalking", "time travel", "magnet",
];
