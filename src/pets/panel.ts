import { escapeHtml } from '../submit';
import { ITEMS } from '../inventory';
import type { Pet } from './pet';

// The pets page (Mike 2026-11-04, pets PR 2): talk to a pet you've befriended to name it, tell it to stay or come,
// and see the others you've befriended, where you can call one instead (one pet with you at a time).
export class PetsPanel {
  readonly el: HTMLDivElement;
  private pet: Pet | null = null;

  constructor(private pets: Pet[], private call: (p: Pet, on: boolean) => void, private onClose: () => void) {
    this.el = document.createElement('div');
    this.el.className = 'forge hidden';
    this.el.id = 'petsPanel';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      if (t.id === 'petName' && this.pet) {
        // Rename in place (no redraw: a redraw here would swallow the click that took the focus off the box).
        this.pet.rename(t.value);
        const h = this.el.querySelector('h2'); if (h) h.textContent = this.pet.name || 'Your ' + this.pet.sp.kind;
      }
    });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  get current() { return this.pet; }

  open(p: Pet) { this.pet = p; this.render(); this.el.classList.remove('hidden'); }
  close() {
    if (!this.isOpen) return;
    const box = this.el.querySelector<HTMLInputElement>('#petName');
    if (box && this.pet && box.value.trim() !== this.pet.name) this.pet.rename(box.value);
    this.el.classList.add('hidden'); this.onClose();
  }

  private render() {
    const p = this.pet!;
    const others = this.pets.filter((o) => o !== p && o.friend);
    const where = (o: Pet) => (o.following ? 'with you' : 'waiting');
    this.el.innerHTML = `<div class="forge-panel pets-panel">
      <div class="eyebrow">Pets</div>
      <h2>${escapeHtml(p.name || 'Your ' + p.sp.kind)}</h2>
      <section><h4>${escapeHtml(p.sp.kind[0].toUpperCase() + p.sp.kind.slice(1))}</h4>
        <label class="field">Name<input id="petName" type="text" maxlength="24" value="${escapeHtml(p.name)}" placeholder="Give your ${p.sp.kind} a name"></label>
        <p class="fine">${p.following ? `${escapeHtml(p.label)} is with you.` : `${escapeHtml(p.label)} is waiting here.`} Likes ${escapeHtml(ITEMS[p.sp.food]?.name.toLowerCase() ?? p.sp.foodName)}.</p>
        <div class="forge-actions"><button class="primary" data-pet-act="${p.following ? 'stay' : 'come'}">${p.following ? 'Stay here' : 'Come with me'}</button></div>
      </section>
      ${others.length ? `<section><h4>Your other pets</h4>${others.map((o) => `<button class="shop-row" data-pet-call="${o.id}"><span>${escapeHtml(o.name || 'The ' + o.sp.kind)}</span><span>${o.following ? where(o) : 'Call'}</span></button>`).join('')}
        <p class="fine">One pet comes with you at a time; the others wait where you left them.</p></section>` : ''}
      <div class="forge-actions"><button class="secondary" data-pet-act="close">Done</button></div>
      <p class="fine">Saved on this device.</p>
    </div>`;
  }

  private click(e: Event) {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b || !this.pet) return;
    const act = b.dataset.petAct, callId = b.dataset.petCall;
    if (act === 'close') { this.close(); return; }
    if (act === 'stay' || act === 'come') { this.call(this.pet, act === 'come'); this.render(); return; }
    const o = this.pets.find((q) => q.id === callId);
    if (o && !o.following) { this.call(o, true); this.render(); }
  }
}
