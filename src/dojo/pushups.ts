import { storeSet } from '../store';
// B26 (Mike 2026-11-01): the camera counts real push-ups. Opt-in only. MediaPipe Pose Lite runs on the device; no
// frame is stored or sent anywhere. The library, its WebAssembly and the model ship beside the page (dist/pose/,
// ~15 MB) and are only fetched the first time the camera is switched on.
// A rep: the elbow (shoulder-elbow-wrist, whichever arm the camera sees better) bends past DOWN, then straightens
// past UP, at least MIN_GAP seconds after the last rep. Knee push-ups count the same way.

const DOWN = 95, UP = 150, MIN_GAP = 0.4;
const KEY = 'gametool.pushups';

/** Up/down state machine on the elbow angle. Starts expecting the arms straight. */
class RepCounter {
  phase: 'up' | 'down' = 'up';
  reps = 0;
  private last = -Infinity;
  /** Feed one elbow angle (degrees) at time t (seconds). Returns true when it completes a rep. */
  feed(angle: number | null, t: number): boolean {
    if (angle === null) return false;
    if (this.phase === 'up' && angle < DOWN) { this.phase = 'down'; return false; }
    if (this.phase === 'down' && angle > UP) {
      this.phase = 'up';
      if (t - this.last < MIN_GAP) return false;
      this.last = t; this.reps++;
      return true;
    }
    return false;
  }
  reset() { this.phase = 'up'; this.reps = 0; this.last = -Infinity; }
}

interface Pt { x: number; y: number; z?: number; visibility?: number }
const ARMS = [[11, 13, 15], [12, 14, 16]] as const;   // left / right: shoulder, elbow, wrist (MediaPipe Pose indices)
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

/** The elbow angle of the arm the camera sees better, or null if neither arm is clear enough. */
function elbowAngle(lm: Pt[] | undefined, world?: Pt[]): number | null {
  if (!lm || lm.length < 17) return null;
  const vis = (i: number) => lm[i].visibility ?? 1;
  const score = ARMS.map((a) => Math.min(...a.map(vis)));
  const k = score[0] >= score[1] ? 0 : 1;
  if (score[k] < 0.5) return null;
  const P = world && world.length >= 17 ? world : lm;
  const [s, e, w] = ARMS[k].map((i) => P[i]);
  const ax = s.x - e.x, ay = s.y - e.y, az = (s.z ?? 0) - (e.z ?? 0), bx = w.x - e.x, by = w.y - e.y, bz = (w.z ?? 0) - (e.z ?? 0);
  const d = Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz);
  if (!d) return null;
  return (Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / d))) * 180) / Math.PI;
}

interface Totals { day: string; today: number; total: number; best: number }
const today = () => new Date().toLocaleDateString('en-CA');
export function loadTotals(): Totals {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const t: Totals = { day: String(v.day ?? ''), today: +v.today || 0, total: +v.total || 0, best: +v.best || 0 };
    if (t.day !== today()) { t.day = today(); t.today = 0; }
    return t;
  } catch { return { day: today(), today: 0, total: 0, best: 0 }; }
}
export function addReps(n: number): Totals {
  const t = loadTotals();
  t.today += n; t.total += n; t.best = Math.max(t.best, t.today);
  storeSet(KEY, JSON.stringify(t));
  return t;
}

/** What the camera needs from a pose model (MediaPipe's PoseLandmarker; tests swap in a stub). */
export interface Landmarker { detectForVideo(v: HTMLVideoElement, ms: number): { landmarks: Pt[][]; worldLandmarks?: Pt[][] }; close?(): void }

let shared: Promise<Landmarker> | null = null;
async function loadMediaPipe(): Promise<Landmarker> {
  const base = new URL('pose/', location.href).href;
  const mp = await import(/* @vite-ignore */ base + 'vision_bundle.mjs');
  const files = await mp.FilesetResolver.forVisionTasks(base + 'wasm');
  const make = (delegate: 'GPU' | 'CPU') => mp.PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: base + 'pose_landmarker_lite.task', delegate }, runningMode: 'VIDEO', numPoses: 1,
  });
  try { return await make('GPU'); } catch { return await make('CPU'); }
}

type CamStatus = 'off' | 'asking' | 'loading' | 'looking' | 'tracking' | 'error';

/** The camera overlay: preview with a skeleton, an always-visible "Camera on" pill, and Stop. */
export class PushupCam {
  readonly counter = new RepCounter();
  status: CamStatus = 'off';
  error = '';
  angle: number | null = null;
  el: HTMLDivElement | null = null;
  loader: () => Promise<Landmarker> = () => (shared ??= loadMediaPipe().catch((e) => { shared = null; throw e; }));
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private raf = 0;
  private seen = 0;

  constructor(private onRep: () => void, private onChange: () => void) {}
  get on() { return this.status !== 'off' && this.status !== 'error'; }
  private stopped() { return this.status === 'off'; }

  async start() {
    if (this.on) return;
    this.counter.reset(); this.error = ''; this.angle = null;
    this.set('asking');
    this.mount();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access here.');
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (this.stopped()) { this.release(); return; }    // stopped while the prompt was up
      const v = this.video!;
      v.srcObject = this.stream;
      await v.play().catch(() => {});
      this.set('loading');
      const lm = await this.loader();
      if (this.stopped()) return;
      this.set('looking');
      this.loop(lm);
    } catch (e) {
      const name = (e as DOMException)?.name;
      this.error = name === 'NotAllowedError' ? 'Camera permission was refused. You can still tap "Rep done".'
        : name === 'NotFoundError' ? 'No camera found. You can still tap "Rep done".'
        : `The camera counter couldn't start (${(e as Error)?.message || name || 'unknown'}). You can still tap "Rep done".`;
      this.release();
      this.set('error');
    }
  }

  stop() {
    if (this.status === 'off') return;
    this.release();
    this.set('off');
  }

  private set(s: CamStatus) {
    this.status = s;
    if (this.el) {
      this.el.dataset.status = s;
      const msg = this.el.querySelector('.pc-msg');
      if (msg) msg.textContent = s === 'asking' ? 'Allow the camera to count your reps.'
        : s === 'loading' ? 'Loading the pose model (first time only)…'
        : s === 'looking' ? 'Side-on, whole body in view, 1–2 m away.'
        : s === 'tracking' ? 'I can see you. Go!' : '';
    }
    this.onChange();
  }

  private mount() {
    this.el?.remove();
    const el = document.createElement('div');
    el.id = 'pushCam';
    el.innerHTML = `<div class="pc-pill" role="status">● Camera on</div>
      <div class="pc-view"><video playsinline muted></video><canvas></canvas></div>
      <div class="pc-msg"></div>
      <div class="pc-row"><span class="pc-reps">0</span><button class="secondary" id="pcStop">Stop camera</button></div>
      <p class="pc-fine">Processed on this device only. Nothing is recorded or sent.</p>`;
    el.querySelector('#pcStop')!.addEventListener('click', () => this.stop());
    document.body.appendChild(el);
    this.el = el;
    this.video = el.querySelector('video');
  }

  private loop(lm: Landmarker) {
    const v = this.video!, cv = this.el!.querySelector('canvas')!, g = cv.getContext('2d');
    let lastMs = -1;
    const step = () => {
      if (!this.on) return;
      this.raf = requestAnimationFrame(step);
      const ms = performance.now();
      if (v.readyState < 2 || ms <= lastMs) return;
      lastMs = ms;
      let r: ReturnType<Landmarker['detectForVideo']>;
      try { r = lm.detectForVideo(v, ms); } catch { return; }
      const pts = r.landmarks?.[0];
      this.angle = elbowAngle(pts, r.worldLandmarks?.[0]);
      if (this.angle !== null) { this.seen = ms; if (this.status === 'looking') this.set('tracking'); }
      else if (this.status === 'tracking' && ms - this.seen > 1500) this.set('looking');
      if (this.counter.feed(this.angle, ms / 1000)) {
        const n = this.el?.querySelector('.pc-reps'); if (n) n.textContent = String(this.counter.reps);
        this.onRep();
      }
      if (g) this.draw(g, cv, v, pts);
    };
    step();
  }

  private draw(g: CanvasRenderingContext2D, cv: HTMLCanvasElement, v: HTMLVideoElement, pts?: Pt[]) {
    const w = (cv.width = v.videoWidth || 320), h = (cv.height = v.videoHeight || 240);
    g.clearRect(0, 0, w, h);
    if (!pts) return;
    g.lineWidth = 4; g.strokeStyle = this.counter.phase === 'down' ? '#E8C878' : '#7FD08A';
    g.beginPath();
    for (const [a, b] of BONES) { if (!pts[a] || !pts[b]) continue; g.moveTo(pts[a].x * w, pts[a].y * h); g.lineTo(pts[b].x * w, pts[b].y * h); }
    g.stroke();
  }

  private release() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.el?.remove(); this.el = null; this.video = null;
  }
}
