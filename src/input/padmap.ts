import { glyph, type PadFamily } from './glyphs';

// The controller map shown in Pause → Controls (and anywhere with [data-padmap]): left and right halves of the pad,
// with button names for the pad in use (Xbox, PlayStation, Nintendo).
const PAD_MAP: [side: 'l' | 'r', button: number | string, what: string][] = [
  ['l', 6, 'Aim (crossbow)'], ['l', 4, 'Camera in · page back'], ['l', 'Left stick', 'Move · click: crouch'],
  ['l', 12, 'Swap shoulder · weapon'], ['l', 14, 'Quick swap: left hand (torch)'], ['l', 13, 'Hold: torch'], ['l', 8, 'Bag · hold: map'],
  ['r', 7, 'Fire · swing'], ['r', 15, 'Quick swap: right hand'], ['r', 5, 'Camera out · page on'], ['r', 3, 'Jump'], ['r', 2, 'Reload'], ['r', 1, 'Sprint · back'],
  ['r', 0, 'Use · talk · read'], ['r', 'Right stick', 'Look · click: change camera'], ['r', 9, 'Pause'],
];
export function renderPadMap(fam: PadFamily) {
  const row = ([, b, what]: (typeof PAD_MAP)[number]) =>
    `<li><kbd class="${typeof b === 'number' && b <= 3 ? 'face face' + b : ''}">${typeof b === 'number' ? glyph(fam, b) : b}</kbd><span>${what}</span></li>`;
  const html = `<ul class="l">${PAD_MAP.filter((r) => r[0] === 'l').map(row).join('')}</ul><ul class="r">${PAD_MAP.filter((r) => r[0] === 'r').map(row).join('')}</ul>`;
  document.querySelectorAll('[data-padmap]').forEach((el) => { el.innerHTML = html; });
}
