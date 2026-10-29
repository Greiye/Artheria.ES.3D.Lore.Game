import * as THREE from 'three';
import { escapeHtml } from './submit';
import './cinema.css';

// v0.04: the Projectionist's reels (a placeholder NPC, never part of the lore). Short clips by Mike and friends from assets/cinema/ (see its README).
// v0.06 R2: reels are WebM only and always loop. Clips start muted (sound is optional); the viewer can turn it on.
// While a video plays, the screen on the Projectionist's stand in town shows it too.
export interface Clip { id: string; title: string; credit: string; sound: boolean; webm: string }
declare const __CINEMA__: Clip[];

export class CinemaPanel {
  readonly el: HTMLDivElement;
  clips: Clip[] = typeof __CINEMA__ === 'undefined' ? [] : __CINEMA__;
  current: Clip | null = null;
  playing: 'video' | null = null;
  muted = true;
  private video: HTMLVideoElement | null = null;
  /** v0.06 T3: called with each new reel's <video> so its sound can come from the screen (positional). */
  onVideo: (v: HTMLVideoElement) => void = () => undefined;
  /** v0.06 T4: a reel with its sound on is playing (the band by the screen plays along). */
  get withSound() { return this.isOpen && !!this.playing && !!this.current?.sound && !this.muted; }

  constructor(private screen: THREE.Mesh, private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.id = 'cinema';
    this.el.className = 'screen hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.render(); this.el.classList.remove('hidden'); if (this.clips.length) this.play(this.clips[0].id); }
  close() {
    if (!this.isOpen) return;
    this.stop();
    this.el.classList.add('hidden');
    this.onClose();
  }

  play(id: string) {
    const c = this.clips.find((x) => x.id === id);
    if (!c) return;
    this.stop();
    this.current = c;
    this.render();
    const stage = this.el.querySelector('.cin-stage')!;
    const v = document.createElement('video');
    v.src = c.webm; v.muted = this.muted || !c.sound; v.playsInline = true; v.autoplay = true; v.loop = true; v.controls = false;
    v.addEventListener('error', () => { if (this.video === v) stage.replaceChildren(Object.assign(document.createElement('p'), { className: 'fine', textContent: "This browser can't play WebM reels." })); }, { once: true });
    stage.replaceChildren(v);
    this.onVideo(v);
    void v.play().catch(() => { /* autoplay refused: the viewer can press play */ });
    this.video = v;
    this.playing = 'video';
    const tex = new THREE.VideoTexture(v);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.setScreen(tex);
  }
  stop() {
    if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); this.video = null; }
    this.playing = null;
    this.setScreen(null);
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.video && this.current) this.video.muted = m || !this.current.sound;
    const b = this.el.querySelector('#cinSound');
    if (b) b.textContent = m ? '🔇 Sound off' : '🔊 Sound on';
  }

  private poster: THREE.Texture | null = null;
  private setScreen(tex: THREE.Texture | null) {
    const m = this.screen.material as THREE.MeshBasicMaterial;
    if (m.map && m.map !== this.poster) m.map.dispose();
    this.poster ??= m.map;
    m.map = tex ?? this.poster;
    m.needsUpdate = true;
  }

  private click(e: Event) {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b) { if (e.target === this.el) this.close(); return; }
    if (b.dataset.clip) this.play(b.dataset.clip);
    else if (b.id === 'cinSound') this.setMuted(!this.muted);
    else if (b.id === 'cinClose') this.close();
  }

  private render() {
    const c = this.current;
    this.el.innerHTML = `<div class="card cinema-card">
      <div class="eyebrow">The Projectionist's reels</div>
      <div class="cin-body">
        <div class="cin-stage">${this.clips.length ? '' : '<p class="fine">No reels yet. Drop short looping .webm clips into <code>assets/cinema/</code>; see its README.</p>'}</div>
        <div class="cin-list">${this.clips.map((x) => `<button class="cin-row${x.id === c?.id ? ' on' : ''}" data-clip="${escapeHtml(x.id)}"><b>${escapeHtml(x.title)}</b>${x.credit ? `<span>by ${escapeHtml(x.credit)}</span>` : ''}</button>`).join('')}</div>
      </div>
      <div class="forge-actions">
        ${c && c.sound ? `<button class="secondary" id="cinSound">${this.muted ? '🔇 Sound off' : '🔊 Sound on'}</button>` : ''}
        <button class="secondary" id="cinClose">Leave</button>
      </div>
    </div>`;
  }
}

/** The projectionist's screen: a painted poster until a reel plays (the stand itself is part of the town batch). */
export function buildScreen(): THREE.Mesh {
  const c = document.createElement('canvas'); c.width = 256; c.height = 144;
  const x = c.getContext('2d')!;
  const grd = x.createRadialGradient(128, 72, 10, 128, 72, 140); grd.addColorStop(0, '#3A2E40'); grd.addColorStop(1, '#14101A');
  x.fillStyle = grd; x.fillRect(0, 0, 256, 144);
  x.fillStyle = '#F2C27A'; x.textAlign = 'center'; x.font = '600 22px Georgia, serif'; x.fillText('✦ Reels tonight ✦', 128, 66);
  x.font = 'italic 14px Georgia, serif'; x.fillStyle = '#C9B89A'; x.fillText('ask the Projectionist', 128, 92);
  const poster = new THREE.CanvasTexture(c); poster.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.35), new THREE.MeshBasicMaterial({ map: poster, toneMapped: false }));
  screen.name = 'cinema-screen';
  return screen;
}
