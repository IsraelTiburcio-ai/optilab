import {test, expect, type FrameLocator, type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const production = process.env.VERIFY_PUBLIC === '1';
const host = production ? 'https://israeltiburcio-ai.github.io/optilab/' : '';
test.skip(!production && !process.env.MEMORAMA_DIR, 'Define MEMORAMA_DIR para candidatos locales o VERIFY_PUBLIC=1 para las URLs publicadas.');

async function prepare(page: Page) {
  if (!production) await page.route('https://israeltiburcio-ai.github.io/memorama-simplex/**', async route => {
    const url = new URL(route.request().url());
    const response = await page.request.get('http://127.0.0.1:5190/' + url.pathname.replace('/memorama-simplex/', '') + url.search);
    await route.fulfill({response});
  });
  await page.addInitScript(() => {
    (window as any).arenaMessages = [];
    window.addEventListener('message', e => {if (e.data?.protocol === 'optilab-game') (window as any).arenaMessages.push(e.data);});
  });
  await page.goto(host + '#/jugar/memorama-simplex');
  await expect(page.locator('.player-status')).toContainText('Conectado', {timeout: 20000});
}

async function pairs(frame: FrameLocator) {
  return frame.locator('#board').evaluate(board => {
    const bank = (window as any).MEMORAMA_DATA.pairs;
    const clean = (html: string) => {const el = document.createElement('div'); el.innerHTML = html; return el.textContent!.replace(/\s+/g, ' ').trim();};
    const groups: Record<string, number[]> = {};
    board.querySelectorAll('.card-text').forEach((el, i) => {
      const text = clean(el.innerHTML);
      const pair = bank.find((p: any) => clean(p.a) === text || clean(p.b) === text);
      if (!pair) throw new Error('Carta fuera del banco académico');
      (groups[pair.id] ||= []).push(i);
    });
    return Object.values(groups);
  });
}
async function time(frame: FrameLocator) {
  const text = await frame.locator('#stat-time').innerText();
  const [minutes, seconds] = text.split(':').map(Number);
  return minutes * 60 + seconds;
}

for (const [width, height] of [[390,844],[820,1180],[1180,820],[1440,900]]) {
  test.describe(`viewport ${width}`, () => {
  test.use({hasTouch: width === 390});
  test(`arena ${width}×${height}: mismo iframe, partida intacta, resultado único`, async ({page, context}) => {
    test.setTimeout(90000);
    await page.setViewportSize({width, height});
    await page.emulateMedia({reducedMotion: 'reduce'});
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    let gameNavigations = 0;
    page.on('request', r => {if (r.isNavigationRequest() && r.url().startsWith('https://israeltiburcio-ai.github.io/memorama-simplex/')) gameNavigations++;});
    await prepare(page);
    const frame = page.frameLocator('.player-frame-shell iframe');
    const element = await page.locator('.player-frame-shell iframe').elementHandle();
    const src = await element!.getAttribute('src');
    await element!.evaluate(el => {(el as any).originalWindow = (el as HTMLIFrameElement).contentWindow;});
    await frame.locator('html').evaluate(() => {(window as any).arenaDocumentMarker = crypto.randomUUID();});
    const marker = await frame.locator('html').evaluate(() => (window as any).arenaDocumentMarker);
    await frame.locator('#btn-play').click();
    const solution = await pairs(frame);
    for (const pair of solution.slice(0, 2)) {
      await frame.locator('.card').nth(pair[0]).click();
      await frame.locator('.card').nth(pair[1]).click();
    }
    // Keep one unmatched card face-up across the first resize, too.
    await frame.locator('.card').nth(solution[2][0]).click();
    await expect.poll(() => time(frame)).toBeGreaterThanOrEqual(1);
    const beforeTime = await time(frame);
    const open = await frame.locator('.card.is-open').evaluateAll(cards => cards.map(c => c.getAttribute('data-index')));
    const enter = page.getByRole('button', {name: 'Pantalla grande', exact: true});
    await enter.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const readyBefore = await page.evaluate(() => (window as any).arenaMessages.filter((m: any) => m.type === 'game:ready').length);
    await enter.click();
    await expect(page.getByRole('dialog', {name: 'Memorama Simplex', exact: true})).toBeVisible();
    const exit = page.getByRole('button', {name: 'Salir de pantalla grande', exact: true});
    await expect(exit).toBeFocused();
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.site-footer')).toBeHidden();
    await expect(page.locator('body')).toHaveAttribute('data-game-arena', 'expanded');
    const box = await page.locator('iframe').boundingBox();
    const exitBox = await exit.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(width - 2);
    expect(box!.height).toBeGreaterThanOrEqual(height - 100);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
    expect(exitBox!.height).toBeGreaterThanOrEqual(44);
    expect(exitBox!.y).toBeGreaterThanOrEqual(0);
    expect(exitBox!.y + exitBox!.height).toBeLessThan(height);
    await page.mouse.move(5, 5);await page.mouse.wheel(0, 650);
    expect(await page.evaluate(() => ({scroll: scrollY, overflow: document.documentElement.scrollWidth > innerWidth}))).toEqual({scroll: 0, overflow: false});
    expect(await element!.evaluate(el => el.isConnected && el === document.querySelector('.player-frame-shell iframe') && (el as any).originalWindow === (el as HTMLIFrameElement).contentWindow)).toBe(true);
    await expect(page.locator('iframe')).toHaveAttribute('src', src!);
    expect(await frame.locator('html').evaluate(() => (window as any).arenaDocumentMarker)).toBe(marker);
    expect(await frame.locator('.card.is-open').evaluateAll(cards => cards.map(c => c.getAttribute('data-index')))).toEqual(open);
    await expect(frame.locator('#stat-pairs')).toHaveText('2/8');
    await expect(frame.locator('#stat-attempts')).toHaveText('2');
    expect(await time(frame)).toBeGreaterThanOrEqual(beforeTime);
    expect(await page.evaluate(() => (window as any).arenaMessages.filter((m: any) => m.type === 'game:ready').length)).toBe(readyBefore);
    // Same game continues in the enlarged viewport.
    await frame.locator('.card').nth(solution[2][1]).click();
    await expect(frame.locator('#stat-pairs')).toHaveText('3/8');
    const board = await frame.locator('#board').boundingBox();
    if (width >= 900) expect(board!.width).toBeGreaterThan(width * .48);
    if (width === 820) expect(board!.width).toBeGreaterThan(730);
    expect(await frame.locator('html').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/arena-${production ? 'public' : 'local'}-${width}.png`});
    const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
    expect(audit.violations.map(v => ({id: v.id, nodes: v.nodes.map(n => n.target)}))).toEqual([]);
    // Exit works with touch/click outside the iframe even while the game has focus.
    if (width === 390) await exit.tap(); else await exit.click();
    await expect(enter).toBeFocused();
    await expect(page.locator('.site-header')).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scrollBefore, 0);
    await expect(frame.locator('#stat-pairs')).toHaveText('3/8');
    await expect(frame.locator('#stat-attempts')).toHaveText('3');
    expect(await time(frame)).toBeGreaterThanOrEqual(beforeTime);
    await enter.click();
    // Host-side Escape restores the view; iframe Escape is deliberately not assumed.
    await exit.focus();await page.keyboard.press('Escape');
    await expect(enter).toBeFocused();
    await enter.click();
    for (const pair of solution.slice(3)) {
      await frame.locator('.card').nth(pair[0]).click();
      await frame.locator('.card').nth(pair[1]).click();
    }
    await expect(frame.locator('#end')).toBeVisible();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('optilab-v1')!).gameResults.length)).toBe(1);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('optilab-v1')!));
    expect(state.gameResults[0]).toMatchObject({matchedPairs: 8, attempts: 8, errors: 0, accuracy: 100});
    expect(await page.evaluate(() => (window as any).arenaMessages.filter((m: any) => m.type === 'game:started').length)).toBe(1);
    expect(await page.evaluate(() => (window as any).arenaMessages.filter((m: any) => m.type === 'game:completed').length)).toBe(1);
    expect(gameNavigations).toBe(1);
    expect(context.pages()).toHaveLength(1);
    await exit.click();
    await expect(page.locator('.game-result-panel')).toContainText('100%');
    await page.getByRole('link', {name: 'Regresar a Fortaleza Simplex', exact: true}).click();
    await expect(page.locator('.gym-banner h1')).toHaveText('Fortaleza Simplex');
    await page.reload();await expect(page.locator('.completion-label')).toContainText('100%');
    expect(errors).toEqual([]);
  });
  });
}

test('arena: navegar desde vista ampliada restaura documento y no finaliza partida incompleta', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await prepare(page);
  const frame = page.frameLocator('iframe');
  await frame.locator('#btn-play').click();await frame.locator('.card').first().click();
  await page.getByRole('button', {name: 'Pantalla grande', exact: true}).click();
  await page.getByRole('link', {name: 'Regresar al gimnasio desde pantalla grande'}).click();
  await expect(page.locator('.gym-banner h1')).toHaveText('Fortaleza Simplex');
  expect(await page.evaluate(() => document.body.hasAttribute('data-game-arena'))).toBe(false);
  expect(await page.evaluate(() => getComputedStyle(document.body).position)).not.toBe('fixed');
  await expect(page.getByRole('navigation', {name: 'Navegación principal'})).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('optilab-v1')!).gameResults)).toEqual([]);
});
