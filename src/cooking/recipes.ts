// B18 (Mike 2026-11-01): campfire cooking with real recipes, simple enough to cook at home with an adult.
// Each recipe: prep steps in order, then the pot or pan on the fire (pick the right heat, take it off when it's done),
// then a finishing step. A cooked meal gives a small buff; the recipe goes in the Recipe book (Journal).
export type Heat = 'low' | 'medium' | 'high';
export type Buff = 'hearty' | 'quick' | 'sturdy';
export interface Recipe {
  id: 'lentejas' | 'flatbread' | 'apples';
  name: string; icon: string; from: string; blurb: string;
  serves: string; time: string;
  ingredients: string[];
  prep: string[];              // tap in order
  heat: Heat; heatWhy: string; // the right heat on the fire
  band: [number, number];      // doneness % to take it off between
  cookText: string;            // what the doneness bar means
  finish: string;
  safety: string;
  buff: Buff;
}

export const COOK_DISCLAIMER = 'Cooking uses heat, boiling water and knives. Only cook for real with an adult in the kitchen. Wash your hands first, and check whether anyone eating has a food allergy.';
export const HEAT_LABEL: Record<Heat, string> = { low: 'Embers (low)', medium: 'Steady flame (medium)', high: 'Roaring (high)' };
/** Doneness % per second on each heat. */
export const HEAT_RATE: Record<Heat, number> = { low: 7, medium: 12, high: 22 };
export const BUFFS: Record<Buff, { name: string; text: string }> = {
  hearty: { name: 'Hearty', text: 'Your next trip below starts with 3 extra hearts.' },
  quick: { name: 'Light on your feet', text: 'You move 10% faster for 3 minutes.' },
  sturdy: { name: 'Well fed', text: 'On your next trip below, goblin hits do 1 less damage.' },
};
export const QUICK_MS = 180_000;

export const RECIPES: Recipe[] = [
  {
    id: 'lentejas', name: 'Lentejas (lentil soup)', icon: '🍲', from: 'La cocinera at the caravan cooks it every night.',
    blurb: 'A thick, warming lentil soup. Cheap, filling, and hard to get wrong.',
    serves: '4', time: '35 minutes',
    ingredients: ['1 cup (200 g) red lentils', '1 onion', '1 carrot', '1 clove of garlic', '1 tablespoon olive oil', '1 teaspoon ground cumin', '4 cups (1 litre) water or vegetable stock', 'Salt, pepper and a squeeze of lemon'],
    prep: [
      'Rinse the lentils in a sieve under cold water.',
      'Chop the onion, carrot and garlic small. Claw grip: fingertips tucked in, knife against your knuckles.',
      'Warm the oil in a pot and soften the vegetables for about 5 minutes, stirring.',
      'Stir in the cumin, then add the lentils and the water or stock.',
      'Bring it to the boil, then turn it down to a gentle simmer.',
    ],
    heat: 'low', heatWhy: 'Lentils want a gentle simmer for about 20 minutes. A hard boil sticks them to the bottom.',
    band: [60, 80], cookText: 'Stir now and then. It is done when the lentils have broken down and the soup is thick.',
    finish: 'Taste it, then add salt, pepper and a squeeze of lemon a little at a time.',
    safety: 'Turn pot handles inward so nobody knocks them. Lift a lid away from you: steam burns. Let soup cool a little before tasting.',
    buff: 'hearty',
  },
  {
    id: 'flatbread', name: 'Pan flatbread', icon: '🫓', from: 'Travellers\' bread: no yeast, no oven.',
    blurb: 'Soft flatbreads cooked in a dry pan in a few minutes.',
    serves: '4 breads', time: '20 minutes',
    ingredients: ['2 cups (250 g) plain flour', '2 teaspoons baking powder', 'Half a teaspoon of salt', 'About three quarters of a cup (180 ml) water', 'A little oil'],
    prep: [
      'Mix the flour, baking powder and salt in a bowl.',
      'Add the water a little at a time and mix to a soft dough that isn\'t sticky.',
      'Knead it for a minute, split it into 4 and press each piece flat, about as thick as a coin stack.',
      'Heat a heavy, dry pan until a drop of water sizzles on it.',
    ],
    heat: 'high', heatWhy: 'A hot pan cooks the bread fast and puffs it up. On low heat it dries out before it browns.',
    band: [70, 85], cookText: 'About 2 minutes a side. It is done when both sides have brown spots and it puffs.',
    finish: 'Flip it once, then brush it with a little oil while it\'s warm.',
    safety: 'The pan and its handle get very hot: use an oven glove or a cloth. Never put a hot pan in water.',
    buff: 'quick',
  },
  {
    id: 'apples', name: 'Baked apples', icon: '🍎', from: 'The camp\'s favourite by the embers.',
    blurb: 'Apples stuffed with oats and honey, baked soft.',
    serves: '2', time: '40 minutes',
    ingredients: ['2 apples', '2 tablespoons rolled oats', '1 tablespoon honey', 'A pinch of cinnamon', 'A small knob of butter'],
    prep: [
      'Wash the apples and cut out the cores with an apple corer (ask an adult to help).',
      'Mix the oats, honey, cinnamon and butter.',
      'Pack the mixture into the hole in each apple.',
      'Wrap each apple in foil, or put them in a covered oven dish.',
    ],
    heat: 'medium', heatWhy: 'Steady heat cooks them through: about 25–30 minutes at the edge of the fire, or in an oven at 180°C (350°F).',
    band: [65, 85], cookText: 'They are done when a knife slides in easily and the skins wrinkle.',
    finish: 'Let them cool for 5 minutes before you unwrap them.',
    safety: 'Foil and the fruit inside get scalding hot: open it with tongs and let it cool. The filling stays hot longest.',
    buff: 'sturdy',
  },
];
