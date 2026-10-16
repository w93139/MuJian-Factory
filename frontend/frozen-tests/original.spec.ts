import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const oldOrigin = 'http://127.0.0.1:3112';
const evidence = path.resolve('../.local-artifacts/real-data-acceptance');
fs.mkdirSync(evidence, { recursive: true });
const stages = ['剧本', '角色', '分镜', '参考图', '视频', '后期'];
const stageTitles = ['剧本生成', '角色 / 场景设计', '分镜设计', '参考图生成', '视频生成', '后期剪辑'];

// No test in this suite may save, delete, upload, or start generation on original data.
test.beforeEach(async ({ context }) => {
  await context.route('**/api/**', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())
    ? route.continue() : route.abort('blockedbyclient'));
});
async function ready(p: Page, url: string) {
  await p.goto(url);
  await expect(p.locator('.mj-sidebar')).toBeVisible();
  await expect(p.getByText('正在验证访问权限…')).toHaveCount(0);
  await expect(p.locator('.mj-main')).not.toContainText('正在加载');
}
async function inventory(p: Page) {
  return p.locator('.mj-main').evaluate(main => [...main.querySelectorAll('h1,h2,h3,button,input:not([type="hidden"]),textarea,select')]
    .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.wave-scene'))
    .map(el => { const r = el.getBoundingClientRect(); return {
      tag: el.tagName,
      fieldKey: [el.tagName, el.getAttribute('type'), el.getAttribute('placeholder')].join('|'),
      fieldLabel: el.closest('label')?.querySelector('span')?.textContent?.trim() || [...(el.closest('label')?.childNodes || [])].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent?.trim()).join(''),
      name: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || (el.tagName === 'SELECT' ? 'select' : el.tagName === 'INPUT' ? el.getAttribute('type') : el.textContent?.trim()),
      disabled: Boolean((el as HTMLButtonElement).disabled), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    }; }));
}
async function compare(p: Page, old: Page, key: string) {
  for (const target of [p, old]) {
    await expect.poll(() => target.locator('.mj-main img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete))).toBe(true);
  }
  const current = await inventory(p), baseline = await inventory(old);
  fs.writeFileSync(path.join(evidence, key + '-controls.json'), JSON.stringify({ baseline, current }, null, 2));
  // Record every control and geometry, including all six stages, for source-backed review.
  // The accepted hero and documented capability/edit fixes are deliberately not pixel identities.
  const missing = baseline.filter(b => b.tag === 'BUTTON' && b.name && !current.some(c => c.tag === b.tag && c.name === b.name));
  expect(missing, key + ': original buttons missing').toEqual([]);
  // Review each original control, including duplicates and positions in all six stages.
  for (let i = 0; i < baseline.length; i++) {
    const b = baseline[i];
    if (key === 'home' && b.tag === 'H1') continue; // User selected a different cinematic title.
    const rank = baseline.slice(0, i).filter(x => x.tag === b.tag && x.name === b.name).length;
    const c = current.filter(x => x.tag === b.tag && x.name === b.name)[rank];
    expect(c, `${key}: ${b.name}`).toBeDefined();
    expect(c.disabled, `${key}: ${b.name} enabled state`).toBe(b.disabled);
    const expected = { x: b.x, y: b.y, w: b.w, h: b.h };
    if (key === 'home') expected.y += 202; // Accepted hero; every original control moves as one block.
    if (/stage-0$/.test(key) && b.y > 120 && b.name !== '重新生成' && b.name !== '修改') expected.y -= 24; // Removed technical description.
    if (/stage-2$/.test(key) && b.tag === 'H2') expected.w = c.w; // Heading shrinks with removed explanatory copy.
    expect({ x: c.x, y: c.y, w: c.w, h: c.h }, `${key}: ${b.name} geometry`).toEqual(expected);
  }
  for (const selector of ['.mj-sidebar-nav', '.mj-sidebar-footer', '.mj-topbar:not(.mj-topbar-home)']) {
    if (await p.locator(selector).count() && await old.locator(selector).count()) {
      expect(await p.locator(selector).boundingBox(), key + selector).toEqual(await old.locator(selector).boundingBox());
    }
  }
  await p.screenshot({ path: path.join(evidence, key + '-new.png') });
  await old.screenshot({ path: path.join(evidence, key + '-old.png') });
}

test('冻结首页、原有历史入口、侧栏位置与收起记忆', async ({ page, context, request }) => {
  const old = await context.newPage();
  const sessions = (await (await request.get('/api/sessions')).json()).sessions;
  expect(sessions.length).toBeGreaterThan(0);
  for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) {
    await ready(p, origin + '/');
    await expect(p.locator('.mj-history-card')).toHaveCount(sessions.length);
    for (const text of ['剧集：', '生成配置', '联网搜索', '上传文件', '逐步创作', '一键生成'])
      await expect(p.getByRole('button', { name: new RegExp(text) }).first()).toBeVisible();
  }
  await compare(page, old, 'home');
  await page.getByRole('button', { name: '收起侧边栏' }).click();
  await expect(page.locator('.mj-sidebar')).toHaveCSS('width', '0px');
  await page.reload();
  await expect(page.getByRole('button', { name: '打开侧边栏' })).toBeVisible();
  await page.getByRole('button', { name: '打开侧边栏' }).click();
  await expect(page.locator('.mj-sidebar')).toHaveCSS('width', '248px');
  await page.goto('/?view=projects');
  await expect(page.locator('.mj-composer')).toBeVisible();
  await expect(page.locator('.wave-scene')).toBeVisible();
  await page.locator('.mj-history-card').first().click();
  await expect(page).toHaveURL(/session=/);
  await expect(page.locator('.mj-topbar nav button')).toHaveCount(6);
});

for (const route of ['/sandbox', '/pipelines/standard', '/pipelines/action-transfer', '/pipelines/digital-human', '/settings']) {
  test('冻结页面控件与位置 ' + route, async ({ page, context }) => {
    const old = await context.newPage();
    for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) {
      await ready(p, origin + route);
      await expect(p.locator('.mj-main h1')).toBeVisible();
      if (route === '/settings') await expect(p.getByRole('button', { name: '保存配置', exact: true })).toBeEnabled();
    }
    await compare(page, old, route.replaceAll('/', '-'));
  });
}

test('原有两个项目逐阶段控件、几何位置与成片播放', async ({ page, context, request }) => {
  test.setTimeout(180000);
  const old = await context.newPage();
  const sessions = (await (await request.get('/api/sessions')).json()).sessions;
  for (let index = 0; index < sessions.length; index++) {
    for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) {
      await ready(p, origin + '/?session=' + sessions[index].id);
      await expect(p.locator('.mj-topbar nav button')).toHaveCount(6);
    }
    for (let i = 0; i < stages.length; i++) {
      for (const p of [page, old]) {
        await p.locator('.mj-topbar nav').getByRole('button', { name: stages[i], exact: true }).click();
        await expect(p.locator('.mj-main main h2').first()).toHaveText(stageTitles[i]);
      }
      await compare(page, old, `session-${index}-stage-${i}`);
      if (i === 4 || i === 5) {
        for (const p of [page, old]) {
          const video = p.locator('.mj-main video').first();
          await expect(video).toBeVisible();
          await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
          await video.evaluate(async (v: HTMLVideoElement) => { v.muted = true; await v.play(); });
          await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
          await video.evaluate((v: HTMLVideoElement) => v.pause());
          if (i === 5) expect(await p.locator('a[download]').first().getAttribute('href')).toContain('/code/');
        }
      }
    }
  }
});

test('原有流水线历史逐条打开，完成任务均能播放', async ({ page, request }) => {
  test.setTimeout(120000);
  const tasks = (await (await request.get('/api/tasks')).json()).tasks;
  expect(tasks.length).toBeGreaterThan(0);
  for (const task of tasks) {
    const route = task.pipeline === 'action_transfer' ? 'action-transfer' : task.pipeline === 'digital_human' ? 'digital-human' : 'standard';
    await ready(page, `/pipelines/${route}?task=${task.task_id}`);
    if (task.status === 'completed') {
      const video = page.locator('.mj-main video').first();
      await expect(video).toBeVisible();
      await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(2);
      await video.evaluate(async (v: HTMLVideoElement) => { v.muted = true; await v.play(); });
      await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
      await video.evaluate((v: HTMLVideoElement) => v.pause());
    } else await expect(page.locator('.mj-main')).toContainText('失败');
  }
});

// Expanded forms contain previously documented API capability fixes. Compare original
// action order explicitly; record added fields instead of pretending pixel identity.
async function compareExpanded(p: Page, old: Page, key: string) {
  const baseline = await inventory(old), current = await inventory(p);
  fs.writeFileSync(path.join(evidence, key + '-controls.json'), JSON.stringify({ baseline, current }, null, 2));
  const actions = current.filter(x => x.tag === 'BUTTON').map(x => x.name);
  let last = -1;
  for (const b of baseline.filter(x => x.tag === 'BUTTON')) {
    const next = actions.findIndex((name, i) => i > last && name === b.name);
    expect(next, `${key}: original action order ${b.name}`).toBeGreaterThan(last);
    last = next;
  }
  const fields = current.filter(x => ['INPUT', 'TEXTAREA', 'SELECT'].includes(x.tag));
  let fieldIndex = -1;
  for (const b of baseline.filter(x => ['INPUT', 'TEXTAREA', 'SELECT'].includes(x.tag))) {
    // Existing contract correction: image-concat mode has no video-resolution parameter.
    if (key === 'pipeline-config-standard' && b.fieldLabel === '视频分辨率') continue;
    const next = fields.findIndex((field, i) => i > fieldIndex && (
      // Capability-driven duration keeps its position, but adds the unit or uses a select.
      key === 'pipeline-config-action-transfer' && b.fieldLabel === '视频时长'
        ? ['视频时长', '视频时长 秒'].includes(field.fieldLabel) && ['INPUT', 'SELECT'].includes(field.tag)
        : field.fieldKey === b.fieldKey && field.fieldLabel === b.fieldLabel
    ));
    expect(next, `${key}: original field order ${b.fieldLabel || b.fieldKey}`).toBeGreaterThan(fieldIndex);
    fieldIndex = next;
  }
  await p.screenshot({ path: path.join(evidence, key + '-new.png') });
  await old.screenshot({ path: path.join(evidence, key + '-old.png') });
}

test('原版创建配置、五种沙盒工具与三条流水线展开表单', async ({ page, context }) => {
  test.setTimeout(120000);
  const old = await context.newPage();
  for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) {
    await ready(p, origin + '/');
    await p.getByRole('button', { name: '生成配置', exact: true }).click();
  }
  await compareExpanded(page, old, 'home-config');
  for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) await ready(p, origin + '/sandbox');
  for (const [index, name] of ['LLM 对话', '图片理解', '文生图', '图生图', '视频生成'].entries()) {
    for (const p of [page, old]) {
      await p.getByRole('button', { name: new RegExp(name) }).first().click();
      await expect(p.locator('.mj-main select').first().locator('option')).not.toHaveCount(0);
    }
    await compareExpanded(page, old, `sandbox-tool-${index}`);
  }
  for (const route of ['standard', 'action-transfer', 'digital-human']) {
    for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) {
      await ready(p, origin + '/pipelines/' + route);
      await p.getByRole('button', { name: '生成配置', exact: true }).click();
    }
    await compareExpanded(page, old, `pipeline-config-${route}`);
  }
});

test('原版剧本与分镜编辑切换取消、续写弹窗、角色参考图放大', async ({ page, context, request }) => {
  const old = await context.newPage();
  const id = (await (await request.get('/api/sessions')).json()).sessions[0].id;
  for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) await ready(p, origin + '/?session=' + id);
  for (const stage of ['剧本', '分镜']) {
    for (const p of [page, old]) {
      await p.locator('.mj-topbar nav').getByRole('button', { name: stage, exact: true }).click();
      await p.getByRole('button', { name: '修改', exact: true }).click();
      await expect(p.getByRole('button', { name: '取消', exact: true })).toBeVisible();
    }
    await compareExpanded(page, old, `edit-${stage}`);
    for (const p of [page, old]) {
      await p.getByRole('button', { name: stage === '剧本' ? 'JSON编辑' : 'JSON', exact: true }).click();
      await expect(p.locator('.mj-main textarea')).toBeVisible();
      await p.getByRole('button', { name: '取消', exact: true }).click();
      await expect(p.getByRole('button', { name: '修改', exact: true })).toBeVisible();
    }
  }
  for (const p of [page, old]) {
    await p.locator('.mj-topbar nav').getByRole('button', { name: '剧本', exact: true }).click();
    await p.getByRole('button', { name: '智能续写', exact: true }).click();
    await expect(p.getByRole('button', { name: '取消', exact: true })).toBeVisible();
  }
  await compareExpanded(page, old, 'continuation-dialog');
  for (const p of [page, old]) await p.getByRole('button', { name: '取消', exact: true }).click();
  for (const stage of ['角色', '参考图']) {
    for (const p of [page, old]) {
      await p.locator('.mj-topbar nav').getByRole('button', { name: stage, exact: true }).click();
      await p.getByTitle('放大查看').first().click();
      await expect(p.getByTitle('关闭')).toBeVisible();
      await p.getByTitle('关闭').click();
    }
  }
});

test('冻结登录与访客首屏布局（固定身份；真实权限另由隔离API回归验证）', async ({ page, context }) => {
  const old = await context.newPage();
  await context.route('**/api/auth/me', route => route.fulfill({ json: { role: 'anonymous', public_mode: true } }));
  for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) {
    await p.goto(origin + '/login');
    await expect(p.getByRole('textbox', { name: '邀请码' })).toBeVisible();
    await expect(p.locator('.mj-sidebar')).toHaveCount(0);
  }
  for (const name of ['进入幕间', '管理员登录']) expect(await page.getByRole('button', { name, exact: true }).boundingBox()).toEqual(await old.getByRole('button', { name, exact: true }).boundingBox());
  await context.unroute('**/api/auth/me');
  await context.route('**/api/auth/me', route => route.fulfill({ json: { role: 'guest', public_mode: true } }));
  for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) {
    await ready(p, origin + '/');
    await expect(p.getByRole('heading', { name: '示例作品', exact: true })).toBeInViewport();
    await expect(p.locator('.wave-stage')).toHaveCount(0);
  }
  await compare(page, old, 'guest-list');
  for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) {
    await p.locator('.mj-main button').first().click();
    for (const name of ['剧本', '角色', '分镜', '参考图', '视频', '成片']) {
      await p.getByRole('button', { name: new RegExp('^' + name) }).click();
      if (!(await p.locator('.mj-main pre').isVisible())) await p.getByText('查看内容详情', { exact: true }).click();
      await expect(p.locator('.mj-main pre')).toBeVisible();
    }
    await p.getByRole('button', { name: '← 返回示例列表' }).click();
    await expect(p).toHaveURL(origin + '/');
  }
});

test('移动端保留原入口，并保留已修复的旧版隐藏侧栏遮挡问题', async ({ page, context, request }) => {
  const old = await context.newPage();
  const id = (await (await request.get('/api/sessions')).json()).sessions[0].id;
  for (const [p, origin] of [[page, ''], [old, oldOrigin]] as const) {
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(origin + '/');
    await expect(p.getByRole('button', { name: '打开侧边栏' })).toBeVisible();
    await p.getByRole('button', { name: '打开侧边栏' }).click();
    await expect(p.locator('.mj-sidebar')).toHaveCSS('width', '248px');
    await p.getByRole('button', { name: '收起侧边栏' }).click();
    await p.goto(origin + '/?session=' + id);
    await expect(p.locator('.mj-topbar nav button')).toHaveCount(6);
    if (p === old) {
      // Frozen CSS forces width 248px even after closing at mobile widths, blocking clicks.
      // Record that defect; do not reproduce it in production or change the frozen source.
      await expect(p.locator('.mj-sidebar')).toHaveCSS('width', '248px');
      continue;
    }
    await expect(p.locator('.mj-sidebar')).toHaveCSS('width', '0px');
    await p.locator('.mj-topbar nav').getByRole('button', { name: '分镜', exact: true }).click();
    expect(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.screenshot({ path: path.join(evidence, 'mobile-new.png') });
  await old.screenshot({ path: path.join(evidence, 'mobile-old.png') });
});
