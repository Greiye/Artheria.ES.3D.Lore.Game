// B19 real-skill mini games (Mike 2026-10-31): knots, first aid and fire craft first. Each skill is two short rounds;
// finishing one earns its skill card for the Skills book. The steps follow common beginner guidance (scouting knot
// books; Red Cross / St John / NHS minor cut and burn care; Leave No Trace fire practice). Safety framing follows
// the B14 dojo: a note to accept first, and nothing here replaces a course or a grown-up who knows how.
export interface OrderRound { kind: 'order'; title: string; ask: string; steps: string[] }
export interface PickRound { kind: 'pick'; title: string; ask: string; right: string[]; wrong: { text: string; why: string }[] }
export type Round = OrderRound | PickRound;
export interface Skill { id: 'knots' | 'firstaid' | 'fire'; name: string; icon: string; blurb: string; safety: string; rounds: Round[]; card: { title: string; lines: string[]; when: string }; reward: number }

export const SKILLS_DISCLAIMER = 'These are beginner basics to practise, not professional training or medical advice. In an emergency, call your local emergency number first. Practise with an adult or a qualified instructor when you can, and never try anything risky on your own.';

export const SKILLS: Skill[] = [
  {
    id: 'knots', name: 'Knots', icon: '🪢', reward: 3,
    blurb: 'Two knots worth knowing: one that ties two ends together, one that makes a loop that will not slip.',
    safety: 'Practise with a shoelace or soft cord. Never tie anything around anyone\'s neck, and never trust a knot you learned here for climbing or lifting a person.',
    rounds: [
      { kind: 'order', title: 'Square (reef) knot', ask: 'Tap the steps in order.', steps: [
        'Hold one end of the cord in each hand.',
        'Cross the right end over the left and tuck it under: the first half-knot.',
        'Cross the left end over the right and tuck it under: the second half-knot.',
        'Pull both ends evenly to tighten.',
        'Check: the two loops lie flat, side by side, with each end next to its own part.',
      ] },
      { kind: 'order', title: 'Bowline', ask: 'Tap the steps in order. (The rabbit comes out of the hole, round the tree, back down the hole.)', steps: [
        'Make a small loop in the long part of the cord, with the end side lying on top. This is the hole.',
        'Bring the end up through the small loop from underneath. The rabbit comes out of the hole.',
        'Take the end round behind the long part. Round the tree.',
        'Bring the end back down through the small loop. Back down the hole.',
        'Hold the end against the big loop and pull the long part to tighten.',
      ] },
    ],
    card: { title: 'Knots', when: 'Square knot: tying a bandage or a bundle (not for loads, it can slip). Bowline: a fixed loop round a post or a tree.',
      lines: ['Square knot: right over left and under, left over right and under.', 'Bowline: out of the hole, round the tree, back down the hole.'] },
  },
  {
    id: 'firstaid', name: 'First aid', icon: '🩹', reward: 3,
    blurb: 'What to do for a small cut and a small burn, at home or on a walk.',
    safety: 'This is for small, everyday injuries. For heavy bleeding, a big or deep wound, a large burn, or a burn on the face, hands or a small child: call your emergency number or get to a doctor.',
    rounds: [
      { kind: 'order', title: 'A small cut', ask: 'Tap the steps in order.', steps: [
        'Wash your hands, or put on gloves, if you can.',
        'Press on the cut with a clean cloth or gauze to stop the bleeding.',
        'Rinse the cut with clean running water.',
        'Pat it dry and cover it with a clean plaster or dressing.',
        'Get help if it keeps bleeding after 10 minutes of pressing, or it is deep, dirty or a bite.',
      ] },
      { kind: 'pick', title: 'A small burn', ask: 'Tap everything that helps. Leave the rest.', right: [
        'Cool it under cool running water for 20 minutes.',
        'Take off rings or anything tight near it before it swells (unless it is stuck to the skin).',
        'Cover it loosely with cling film or a clean dressing that won\'t stick.',
      ], wrong: [
        { text: 'Put ice on it.', why: 'Ice can damage the skin more. Cool running water is right.' },
        { text: 'Rub butter or toothpaste on it.', why: 'They hold the heat in and can cause infection.' },
        { text: 'Pop the blisters.', why: 'Blisters protect the skin underneath. Leave them alone.' },
      ] },
    ],
    card: { title: 'First aid', when: 'Small cuts and small burns. Anything big: call for help first.',
      lines: ['Cut: clean hands, press, rinse, cover.', 'Burn: cool running water for 20 minutes, rings off, cover loosely. No ice, no butter, no popping blisters.'] },
  },
  {
    id: 'fire', name: 'Fire craft', icon: '🔥', reward: 3,
    blurb: 'How to lay a small campfire, and how to put it out properly.',
    safety: 'Only with an adult, and only where fires are allowed: check for fire bans first. Keep water close, keep the fire small, and never leave it alone.',
    rounds: [
      { kind: 'order', title: 'Lay and light a fire', ask: 'Tap the steps in order.', steps: [
        'Pick a fire pit or bare ground, away from tents, dry grass and low branches.',
        'Put a bucket of water or sand next to it.',
        'Make a small pile of tinder: dry grass, paper or wood shavings.',
        'Lean pencil-thin dry kindling over the tinder like a little tent.',
        'Light the tinder low down, on the side the wind is coming from.',
        'Add thicker wood a little at a time as the kindling catches.',
      ] },
      { kind: 'order', title: 'Put it out', ask: 'Tap the steps in order. (Drown, stir, feel.)', steps: [
        'Let it burn down to ash if you can.',
        'Drown it: pour water over all the embers, not just the flames.',
        'Stir the ashes with a stick, then pour on more water.',
        'Feel for heat with the back of your hand held just above. Repeat until it is cold.',
      ] },
    ],
    card: { title: 'Fire craft', when: 'A small campfire where fires are allowed, with an adult.',
      lines: ['Lay: clear spot, water ready, tinder, kindling tent, light upwind, feed slowly.', 'Out: drown, stir, feel. Cold to the touch before you leave.'] },
  },
];
