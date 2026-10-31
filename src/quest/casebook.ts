import { QUEST, AXES, clueById, readTags, support, ending, tagLabel, type Axis, type QuestState, type Theory } from './quest';
import { ConstraintDice, type Roll, type DieKind } from '../forge/dice';
import { entryMarkdown, openSubmitSheet, escapeHtml } from '../submit';
import './quest.css';

// B2 casebook (J): the clues you found, and the page where you write your theory. Committing the theory
// sets the lead; after the lead, the casebook holds the ending (Natalie's finished field note).
function theoryMarkdown(th: Theory, author: string): string {
  const tags = AXES.map((a) => `- **${a[0].toUpperCase() + a.slice(1)}:** ${tagLabel(a, th[a])}`).join('\n');
  return entryMarkdown({
    title: `A theory: ${tagLabel('who', th.who)}`, author, type: 'theory', tags: ['theory', 'natalie', th.who, th.where],
    body: `${th.text}\n\n${tags}${th.roll ? `\n\n*Dice: ${th.roll.word} · ${th.roll.mood} · ${th.roll.rule}*` : ''}`,
    extra: { reply_to: 'natalies-field-note' },
  });
}

export class Casebook {
  owner: () => string = () => '';   // B25: the hero's name from the Journal (blank = just "Casebook")
  readonly el: HTMLDivElement;
  private pick: Partial<Record<Axis, string>> = {};
  private text = '';
  private roll: Roll | null = null;
  private dice: ConstraintDice;

  constructor(private state: () => QuestState, private onCommit: (th: Theory) => void, private onClose: () => void, loreWords: string[], private author: () => string) {
    this.dice = new ConstraintDice(loreWords);
    this.el = document.createElement('div');
    this.el.id = 'casebook';
    this.el.className = 'forge hidden';
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('input', (e) => {
      if ((e.target as HTMLElement).id !== 'cbTheory') return;
      this.text = (e.target as HTMLTextAreaElement).value;
      this.renderReading();
    });
  }
  get isOpen() { return !this.el.classList.contains('hidden'); }
  open() { this.render(); this.el.classList.remove('hidden'); }
  close() { if (!this.isOpen) return; this.el.classList.add('hidden'); this.onClose(); }

  // Exposed for tests: fill the theory as a player would.
  setTag(axis: Axis, v: string) { this.pick[axis] = v; this.render(); }

  private chosen(): Partial<Record<Axis, string>> {
    const guess = readTags(this.text);
    return Object.fromEntries(AXES.map((a) => [a, this.pick[a] ?? guess[a]]).filter(([, v]) => v));
  }

  private click(ev: Event) {
    const t = (ev.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) return;
    const d = t.dataset;
    if (d.axis) { this.pick[d.axis as Axis] = d.v; this.render(); }
    else if (t.id === 'cbRoll') { this.roll = this.dice.roll(); this.render(); }
    else if (d.die && this.roll) { this.roll = this.dice.reroll(this.roll, d.die as DieKind) ?? this.roll; this.render(); }
    else if (t.id === 'cbCommit') {
      const c = this.chosen();
      if (this.text.trim().length < 12 || AXES.some((a) => !c[a])) return;
      this.onCommit({ text: this.text.trim(), who: c.who!, where: c.where!, why: c.why!, roll: this.roll ?? undefined, written: new Date().toISOString().slice(0, 10) });
      this.render();
    }
    else if (t.id === 'cbSubmit') { const th = this.state().theory; if (th) openSubmitSheet({ kind: 'theory', title: `A theory: ${tagLabel('who', th.who)}`, markdown: theoryMarkdown(th, this.author()) }); }
    else if (t.id === 'cbClose') this.close();
  }

  private renderReading() {
    const box = this.el.querySelector('.cb-reading');
    const guess = readTags(this.text);
    if (box) box.textContent = Object.keys(guess).length ? `Natalie reads: ${AXES.filter((a) => guess[a]).map((a) => tagLabel(a, guess[a]!)).join(' · ')}` : '';
    const c = this.chosen();
    this.el.querySelectorAll<HTMLButtonElement>('[data-axis]').forEach((b) => b.classList.toggle('on', c[b.dataset.axis as Axis] === b.dataset.v));
    const ok = this.text.trim().length >= 12 && AXES.every((a) => c[a]);
    const btn = this.el.querySelector<HTMLButtonElement>('#cbCommit');
    if (btn) btn.disabled = !ok;
  }

  private render() {
    const s = this.state(), q = QUEST;
    const ta = this.el.querySelector<HTMLTextAreaElement>('#cbTheory');
    if (ta) this.text = ta.value;
    const clues = s.clues.map((id) => clueById(id)).filter(Boolean).map((c) => `
      <li class="cb-clue"><b>${escapeHtml(c!.name)}</b><span>${escapeHtml(c!.text)}</span><em>Natalie: “${escapeHtml(c!.natalie)}”</em></li>`).join('');
    const enough = s.clues.length >= q.minClues;
    let body = '';
    if (s.stage === 'clues' || s.stage === 'none') {
      body = enough ? `
        <h4>Your theory</h4>
        <textarea id="cbTheory" rows="5" maxlength="1200" placeholder="What happened to them? Write it the way you'd tell it.">${escapeHtml(this.text)}</textarea>
        <p class="cb-reading fine"></p>
        ${AXES.map((a) => `<h5>${a}</h5><div class="chips">${Object.entries(q.tags[a]).map(([v, label]) => `<button class="chip" data-axis="${a}" data-v="${v}">${escapeHtml(label)}</button>`).join('')}</div>`).join('')}
        <div class="dice-row"><button class="secondary" id="cbRoll">Roll constraint dice (optional)</button>
          ${this.roll ? `<div class="dice">${(['word', 'mood', 'rule'] as DieKind[]).map((k) => `<button class="die" data-die="${k}"><b>${k}</b>${escapeHtml(this.roll![k])}</button>`).join('')}</div><p class="fine">Work all three into the theory (${this.dice.rerolls} rerolls left).</p>` : ''}</div>
        <div class="forge-actions"><button class="primary" id="cbCommit" disabled>This is what happened</button></div>
        <p class="fine">There's no wrong answer. Your theory decides where you look next.</p>`
        : `<p class="cb-hint">${escapeHtml(s.clues.length ? q.natalie.hintMore : q.natalie.hintNone)} (${s.clues.length} of ${q.minClues} clues)</p>`;
    } else if (s.theory) {
      const th = s.theory, backed = support(s, th);
      body = `
        <h4>Your theory</h4>
        <blockquote class="cb-theory">${escapeHtml(th.text)}</blockquote>
        <p class="cb-tags">${AXES.map((a) => `<span>${escapeHtml(tagLabel(a, th[a]))}</span>`).join('')}</p>
        <p class="cb-hint">Natalie: “${escapeHtml(backed >= 2 ? q.natalie.supported : q.natalie.leap)}” <span class="fine">(${backed} of 3 backed by clues)</span></p>
        ${s.stage === 'lead' ? `<p class="cb-lead">Lead: <b>${escapeHtml(tagLabel('where', th.where))}</b>. Follow the blue light.</p>` : ''}
        ${s.stage === 'done' ? `<h4>Natalie's field note, finished</h4><blockquote class="cb-ending">${escapeHtml(ending(th).note)}</blockquote>` : ''}
        <div class="forge-actions"><button class="secondary" id="cbSubmit">Submit my theory…</button></div>`;
    }
    this.el.innerHTML = `
      <div class="forge-panel casebook-panel">
        <div class="eyebrow">${this.owner() ? `Casebook of ${escapeHtml(this.owner())}` : 'Casebook'} · J</div>
        <h2>${escapeHtml(q.title)}</h2>
        <p class="fine">${escapeHtml(q.intro)}</p>
        <h4>Clues · ${s.clues.length} of ${q.clues.length}</h4>
        <ul class="cb-clues">${clues || '<li class="fine">Nothing yet. Look for things that are out of place (E).</li>'}</ul>
        ${body}
        <div class="forge-actions"><button class="secondary" id="cbClose">Close</button></div>
      </div>`;
    this.renderReading();
  }
}
