// The pause menu's settings controls (F1.1 graphics, F1.2 audio, comfort, camera): each control writes the setting,
// saves it and applies it live. Moved out of main.ts (2026-11-10); main.ts hands over the few things it owns.
import type * as THREE from 'three';
import { saveSettings, PRESETS, type Settings, type Preset, type FpsCap, type View } from '../settings';
import { haptics } from '../input/haptics';
import { reading } from '../reading';
import { renderPadMap } from '../input/padmap';
import { setSpriteCharacters } from '../render/sprites';
import { setOutlines } from '../render/outline';

export interface SettingsMenuDeps {
  settings: Settings;
  camera: THREE.PerspectiveCamera;
  setView: (v: View) => void;
  VIEWS: View[];
  inputMode: Parameters<typeof haptics.setMode>[0];
  touch: { lefty: boolean } | null;
  applyQuality: () => void;
  applyRenderScale: () => void;
  syncForest: () => void;
  /** The post-processing chain, once it exists. */
  post: () => { setEnabled(on: boolean): void } | null;
  world: { setFogDistance(m: number): void };
  nightLights: { setMax(n: number): void };
  LIGHTS: Record<Preset, number>;
  autoQ: { setEnabled(on: boolean): void };
  audio: { setLevel(bus: 'master' | 'music' | 'sfx' | 'dialogue', v: number): void; setMuted(bus: 'master' | 'music' | 'sfx' | 'dialogue', m: boolean): void };
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Wires every settings control and applies the saved values. */
export function setupSettingsMenu(d: SettingsMenuDeps): void {
  const { settings, camera, setView, VIEWS, touch, applyQuality, applyRenderScale, syncForest, world, nightLights, LIGHTS, autoQ, audio } = d;
  const sens = $<HTMLInputElement>('sens'), fov = $<HTMLInputElement>('fov');
  const inv = $<HTMLInputElement>('invert'), always = $<HTMLInputElement>('always');
  const presetSel = $<HTMLSelectElement>('preset'), renderScaleEl = $<HTMLInputElement>('renderScale');
  const shadowsEl = $<HTMLInputElement>('shadows'), postFxEl = $<HTMLInputElement>('postFx');
  const fogDistanceEl = $<HTMLInputElement>('fogDistance'), fpsCapSel = $<HTMLSelectElement>('fpsCap'), autoQualityEl = $<HTMLInputElement>('autoQuality');
  const audioEls = {
    master: $<HTMLInputElement>('audioMaster'), muteMaster: $<HTMLInputElement>('muteMaster'),
    music: $<HTMLInputElement>('audioMusic'), muteMusic: $<HTMLInputElement>('muteMusic'),
    sfx: $<HTMLInputElement>('audioSfx'), muteSfx: $<HTMLInputElement>('muteSfx'),
    dialogue: $<HTMLInputElement>('audioDialogue'), muteDialogue: $<HTMLInputElement>('muteDialogue'),
  };
  function syncMenu() {
    sens.value = String(settings.sensitivity); $('sensOut').textContent = settings.sensitivity.toFixed(2);
    fov.value = String(settings.fov); $('fovOut').textContent = settings.fov + '°';
    inv.checked = settings.invertY; always.checked = settings.alwaysRun;
    $<HTMLInputElement>('haptics').checked = settings.haptics;
    $<HTMLInputElement>('seeThrough').checked = settings.seeThrough;
    $<HTMLInputElement>('autoLean').checked = settings.autoLean;
    $<HTMLSelectElement>('cameraLead').value = settings.cameraLead;
    $<HTMLInputElement>('lefty').checked = settings.lefty;
    $<HTMLInputElement>('buttonSize').value = String(settings.buttonSize); $('buttonSizeOut').textContent = settings.buttonSize + '%';
    $<HTMLInputElement>('textSize').value = String(settings.textSize); $('textSizeOut').textContent = settings.textSize + '%';
    $<HTMLInputElement>('readSpeed').value = String(settings.readSpeed); $('readSpeedOut').textContent = settings.readSpeed + '×';
    $<HTMLSelectElement>('viewSel').value = settings.view;
    $<HTMLSelectElement>('charsSel').value = settings.chars;
    presetSel.value = settings.preset;
    renderScaleEl.value = String(settings.renderScale); $('renderScaleOut').textContent = settings.renderScale + '%';
    shadowsEl.checked = settings.shadows; postFxEl.checked = settings.postFx;
    $<HTMLInputElement>('inkLines').checked = settings.inkLines;
    fogDistanceEl.value = String(settings.fogDistance); $('fogOut').textContent = settings.fogDistance + ' m';
    fpsCapSel.value = String(settings.fpsCap); autoQualityEl.checked = settings.autoQuality;
    audioEls.master.value = String(settings.audio.master); $('audioMasterOut').textContent = settings.audio.master + '%';
    audioEls.muteMaster.checked = settings.audio.muteMaster;
    audioEls.music.value = String(settings.audio.music); $('audioMusicOut').textContent = settings.audio.music + '%';
    audioEls.muteMusic.checked = settings.audio.muteMusic;
    audioEls.sfx.value = String(settings.audio.sfx); $('audioSfxOut').textContent = settings.audio.sfx + '%';
    audioEls.muteSfx.checked = settings.audio.muteSfx;
    audioEls.dialogue.value = String(settings.audio.dialogue); $('audioDialogueOut').textContent = settings.audio.dialogue + '%';
    audioEls.muteDialogue.checked = settings.audio.muteDialogue;
  }
  sens.addEventListener('input', () => { settings.sensitivity = Number(sens.value); saveSettings(settings); syncMenu(); });
  fov.addEventListener('input', () => {
    settings.fov = Number(fov.value); saveSettings(settings); syncMenu();
    camera.fov = settings.fov; camera.updateProjectionMatrix();
  });
  inv.addEventListener('change', () => { settings.invertY = inv.checked; saveSettings(settings); });
  const viewSel = $<HTMLSelectElement>('viewSel');
  viewSel.addEventListener('change', () => setView(VIEWS.includes(viewSel.value as View) ? viewSel.value as View : 'overhead'));
  $<HTMLSelectElement>('cameraLead').addEventListener('change', (e) => { const v = (e.target as HTMLSelectElement).value; settings.cameraLead = v === 'on' || v === 'off' ? v : 'auto'; saveSettings(settings); });
  $<HTMLInputElement>('autoLean').addEventListener('change', (e) => { settings.autoLean = (e.target as HTMLInputElement).checked; saveSettings(settings); });   // B41
  $<HTMLInputElement>('seeThrough').addEventListener('change', (e) => { settings.seeThrough = (e.target as HTMLInputElement).checked; saveSettings(settings); });
  $<HTMLInputElement>('haptics').addEventListener('change', (e) => {
    settings.haptics = (e.target as HTMLInputElement).checked; saveSettings(settings);
    haptics.setEnabled(settings.haptics);
    haptics.play('tap');
  });
  haptics.setEnabled(settings.haptics);
  haptics.setMode(d.inputMode);
  // UX pass (Mike 2026-10-31): comfort settings take effect at once.
  function applyComfort() {
    const root = document.documentElement.style;
    root.setProperty('--tb', String(settings.buttonSize / 100));
    root.setProperty('--text-k', String(settings.textSize / 100));
    reading.speed = settings.readSpeed;
    if (touch) touch.lefty = settings.lefty;
    if (settings.lefty) document.body.dataset.lefty = '1'; else delete document.body.dataset.lefty;
  }
  applyComfort();
  for (const id of ['lefty', 'buttonSize', 'textSize', 'readSpeed'] as const) {
    $<HTMLInputElement>(id).addEventListener(id === 'lefty' ? 'change' : 'input', (e) => {
      const el = e.target as HTMLInputElement;
      if (id === 'lefty') settings.lefty = el.checked; else settings[id] = Number(el.value);
      saveSettings(settings); applyComfort(); syncMenu();
    });
  }
  document.body.dataset.pad = 'xbox';
  renderPadMap('xbox');
  const charsSel = $<HTMLSelectElement>('charsSel');
  charsSel.addEventListener('change', () => {
    settings.chars = charsSel.value === 'sprite' ? 'sprite' : 'hybrid'; saveSettings(settings);
    setSpriteCharacters(settings.chars === 'sprite');
  });
  setSpriteCharacters(settings.chars === 'sprite');
  always.addEventListener('change', () => { settings.alwaysRun = always.checked; saveSettings(settings); });

  // F1.1 graphics — a preset fills every slider below it; each slider then applies live on its own.
  presetSel.addEventListener('change', () => {
    const p = presetSel.value as Preset;
    settings.preset = p;
    Object.assign(settings, PRESETS[p]);
    saveSettings(settings); syncMenu();
    applyQuality(); d.post()?.setEnabled(settings.postFx); world.setFogDistance(settings.fogDistance); syncForest(); nightLights.setMax(LIGHTS[p]);
  });
  renderScaleEl.addEventListener('input', () => { settings.renderScale = Number(renderScaleEl.value); saveSettings(settings); syncMenu(); applyRenderScale(); });
  shadowsEl.addEventListener('change', () => { settings.shadows = shadowsEl.checked; saveSettings(settings); applyQuality(); });
  $<HTMLInputElement>('inkLines').addEventListener('change', (e) => { settings.inkLines = (e.target as HTMLInputElement).checked; saveSettings(settings); setOutlines(settings.inkLines); });
  postFxEl.addEventListener('change', () => { settings.postFx = postFxEl.checked; saveSettings(settings); d.post()?.setEnabled(settings.postFx); });
  fogDistanceEl.addEventListener('input', () => { settings.fogDistance = Number(fogDistanceEl.value); saveSettings(settings); syncMenu(); world.setFogDistance(settings.fogDistance); syncForest(); });
  fpsCapSel.addEventListener('change', () => { settings.fpsCap = Number(fpsCapSel.value) as FpsCap; saveSettings(settings); });
  autoQualityEl.addEventListener('change', () => { settings.autoQuality = autoQualityEl.checked; saveSettings(settings); autoQ.setEnabled(settings.autoQuality); });

  // F1.2 audio — one GainNode per bus; a slider/mute only ever touches its own bus (src/audio.ts).
  (['master', 'music', 'sfx', 'dialogue'] as const).forEach((b) => {
    audioEls[b].addEventListener('input', () => { settings.audio[b] = Number(audioEls[b].value); saveSettings(settings); syncMenu(); audio.setLevel(b, settings.audio[b]); });
    const muteKey = ('mute' + b[0].toUpperCase() + b.slice(1)) as 'muteMaster' | 'muteMusic' | 'muteSfx' | 'muteDialogue';
    audioEls[muteKey].addEventListener('change', () => { settings.audio[muteKey] = audioEls[muteKey].checked; saveSettings(settings); audio.setMuted(b, settings.audio[muteKey]); });
  });
  syncMenu();
}
