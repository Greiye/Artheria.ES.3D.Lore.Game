import { loadTotals } from './pushups';

// B26: the push-up card in the Journal's Skills book. Earned by finishing the dojo's push-up drill once.
export function pushupCardHtml(learned: boolean): string {
  if (!learned) return '<div class="sk-card locked"><div class="sk-card-head"><span>💪</span><b>Push-ups</b></div><p class="fine">Not learned yet. Do the push-up drill on the dojo mats.</p></div>';
  const t = loadTotals();
  return `<div class="sk-card"><div class="sk-card-head"><span>💪</span><b>Push-ups</b></div>
    <ul><li>Hands a little wider than the shoulders; knees down is the beginner version.</li>
    <li>One straight line from head to knees or heels; don't let the hips sag.</li>
    <li>Elbows bend past a right angle, then push back to straight. Breathe out going up.</li></ul>
    <p class="fine">Today ${t.today} · best day ${t.best} · all time ${t.total}. Stop if wrists, shoulders or back hurt.</p></div>`;
}
