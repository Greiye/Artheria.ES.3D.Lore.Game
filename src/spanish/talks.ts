import type { FigureLook } from '../world/figure';

// B16: what the caravan says. Spanish only; the English here is stage direction (gesture) for the player's eyes,
// never a translation. `typed` lists words that make a written reply understood (accents and case don't matter);
// `wrongTyped` lists words that make it a misunderstanding even so. {name} is the hero's name (B25), or "Viajero".
export interface Answer { es: string; ok: boolean }
export interface Line { es: string; cue: string; gesture: string; answers: Answer[]; typed: string[]; wrongTyped?: string[] }
export interface Talk { id: 'cook' | 'weaver' | 'muleteer'; role: string; pronoun: string; verb: string; look: Partial<FigureLook>; lines: Line[]; farewell: { es: string; cue: string; gesture: string }; reward: number }

export const TALKS: Talk[] = [
  {
    id: 'cook', role: 'La cocinera', pronoun: 'The cook', verb: 'Talk to the cook (Spanish)', reward: 4,
    look: { primary: '#B8432F', secondary: '#E8DCC0', accent: '#D99A2B', skirt: true },
    lines: [
      { es: '¡Hola! ¿Cómo te llamas?', cue: '👋', gesture: 'waves a ladle, then points it at you.',
        answers: [{ es: 'Me llamo {name}.', ok: true }, { es: 'Tengo frío.', ok: false }, { es: 'Adiós.', ok: false }],
        typed: ['me llamo', 'soy', 'mi nombre'], wrongTyped: ['adios'] },
      { es: '¿Tienes hambre?', cue: '🍲', gesture: 'lifts the lid of the pot and lets the steam out.',
        answers: [{ es: 'Me llamo Sopa.', ok: false }, { es: 'Sí, gracias.', ok: true }, { es: 'No, gracias.', ok: true }],
        typed: ['si', 'no', 'mucha', 'un poco'] },
      { es: 'Toma. Es sopa de lentejas. ¿Te gusta?', cue: '🥣', gesture: 'hands you a bowl and watches you taste it.',
        answers: [{ es: '¡Sí, me gusta mucho!', ok: true }, { es: 'Es azul.', ok: false }, { es: 'No mucho, lo siento.', ok: true }],
        typed: ['me gusta', 'rica', 'rico', 'buena', 'si', 'no mucho'] },
      { es: '¡Qué bien! Buen provecho.', cue: '😊', gesture: 'smiles and goes back to stirring.',
        answers: [{ es: 'Buenas noches, mula.', ok: false }, { es: '¡Gracias!', ok: true }],
        typed: ['gracias'] },
    ],
    farewell: { es: '¡Hasta luego, {name}!', cue: '🥄', gesture: 'taps the ladle on the pot: goodbye.' },
  },
  {
    id: 'weaver', role: 'La tejedora', pronoun: 'The weaver', verb: 'Talk to the weaver (Spanish)', reward: 4,
    look: { primary: '#2F7F86', secondary: '#E6D6B0', accent: '#B8432F' },
    lines: [
      { es: 'Buenas tardes. ¿Te gusta este color?', cue: '🟥', gesture: 'holds up a red shawl against the light.',
        answers: [{ es: 'Sí, me gusta el rojo.', ok: true }, { es: 'Tengo hambre.', ok: false }, { es: 'No, prefiero el azul.', ok: true }],
        typed: ['rojo', 'azul', 'me gusta', 'prefiero', 'bonito', 'si', 'no'] },
      { es: 'Este, el azul, cuesta cinco coronas.', cue: '🟦 🖐️', gesture: 'holds up a blue shawl, then five fingers.',
        answers: [{ es: 'Es muy caro.', ok: true }, { es: '¿De dónde vienes?', ok: false }, { es: 'Vale, aquí tienes.', ok: true }],
        typed: ['caro', 'aqui tienes', 'vale', 'cinco', 'de acuerdo'] },
      { es: 'Para ti, tres. ¡Es un buen precio!', cue: '🤝', gesture: 'laughs, folds three fingers away and nods.',
        answers: [{ es: 'Gracias, es usted muy amable.', ok: true }, { es: 'Me llamo Azul.', ok: false }],
        typed: ['gracias', 'amable', 'vale', 'bien'] },
      { es: 'Hasta luego. ¡Vuelve pronto!', cue: '👋', gesture: 'waves you off with the shawl.',
        answers: [{ es: '¡Hasta luego!', ok: true }, { es: 'Sí, me gusta la sopa.', ok: false }, { es: '¡Adiós!', ok: true }],
        typed: ['hasta luego', 'adios', 'chao', 'chau', 'hasta pronto'] },
    ],
    farewell: { es: '¡Vuelve pronto!', cue: '🧶', gesture: 'is already weaving again.' },
  },
  {
    id: 'muleteer', role: 'El arriero', pronoun: 'The muleteer', verb: 'Talk to the muleteer (Spanish)', reward: 5,
    look: { primary: '#6B4428', secondary: '#D8C8A0', accent: '#2F7F86' },
    lines: [
      { es: 'Buenos días. ¿De dónde vienes?', cue: '🧭', gesture: 'points down the road, then at you.',
        answers: [{ es: 'Tengo dos mulas.', ok: false }, { es: 'Vengo del pueblo.', ok: true }, { es: 'Vengo del bosque.', ok: true }],
        typed: ['vengo', 'soy de', 'del pueblo', 'del bosque'] },
      { es: 'Nosotros vamos al norte, a la biblioteca vieja.', cue: '🏚️', gesture: 'points north, toward the burnt stone hall.',
        answers: [{ es: '¿Por qué?', ok: true }, { es: '¡Buen viaje!', ok: true }, { es: 'Me gusta el rojo.', ok: false }],
        typed: ['por que', 'buen viaje', 'yo tambien', 'cuidado'] },
      { es: 'La mula está cansada. ¿Me ayudas con el agua?', cue: '🐴 💧', gesture: 'lifts an empty bucket and nods at the mule.',
        answers: [{ es: 'Sí, claro.', ok: true }, { es: 'Buenas noches.', ok: false }, { es: 'Lo siento, no puedo.', ok: true }],
        typed: ['claro', 'si', 'vale', 'no puedo', 'lo siento'] },
      { es: '¡Muchas gracias, amigo!', cue: '🤝', gesture: 'shakes your hand hard.',
        answers: [{ es: 'De nada.', ok: true }, { es: 'Es muy caro.', ok: false }],
        typed: ['de nada', 'a ti', 'a usted', 'no hay de que'] },
    ],
    farewell: { es: '¡Que te vaya bien!', cue: '🐴', gesture: 'pats the mule; the mule ignores you.' },
  },
];
