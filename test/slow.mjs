// Preloaded by scripts/e2e-run.mjs when E2E_SLOW is set (the nightly CI job sets it): stretches every fixed wait and
// every timeout by that factor. The suites were tuned on a desktop; a shared CI runner draws the software-rendered game
// two to three times slower, so "wait 1.5 s, then look" saw too few frames there and a different tenth of the checks
// failed on every run. Nothing is skipped: each check still has to pass, it is only given the frames it assumed.
import { chromium } from 'playwright-core';

const K = Number(process.env.E2E_SLOW) || 1;
if (K !== 1) {
  const scaled = (o) => (o && typeof o.timeout === 'number' && o.timeout > 0 ? { ...o, timeout: o.timeout * K } : o);
  const patchPage = (page) => {
    page.setDefaultTimeout(30000 * K);
    const wait = page.waitForTimeout.bind(page), fn = page.waitForFunction.bind(page), sel = page.waitForSelector.bind(page), ev = page.waitForEvent.bind(page), go = page.goto.bind(page);
    page.waitForTimeout = (ms) => wait(ms * K);
    page.waitForFunction = (f, arg, o) => fn(f, arg, scaled(o));
    page.waitForSelector = (s, o) => sel(s, scaled(o));
    page.waitForEvent = (e, o) => ev(e, typeof o === 'function' ? o : scaled(o));
    page.goto = (u, o) => go(u, scaled(o));
    return page;
  };
  const patchContext = (ctx) => {
    const newPage = ctx.newPage.bind(ctx);
    ctx.newPage = async (...a) => patchPage(await newPage(...a));
    ctx.on('page', patchPage);   // pop-ups and pages opened by the game
    return ctx;
  };
  const launch = chromium.launch.bind(chromium);
  chromium.launch = async (...a) => {
    const browser = await launch(...a);
    const newContext = browser.newContext.bind(browser), newPage = browser.newPage.bind(browser);
    browser.newContext = async (...b) => patchContext(await newContext(...b));
    browser.newPage = async (...b) => patchPage(await newPage(...b));
    return browser;
  };
}
