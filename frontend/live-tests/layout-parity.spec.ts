import { expect, test, type Page } from '@playwright/test';

const legacyOrigin = 'http://127.0.0.1:18777';
async function login(page: Page, origin = '') {
  await page.goto(`${origin}/login`);
  await page.getByRole('button', { name: '管理员登录', exact: true }).click();
  await page.getByLabel('管理员密码').fill('e2e-admin-password');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page.locator('.mj-composer')).toBeVisible();
}
async function controls(page: Page) {
  return page.locator('#main-content').evaluate(main => [...main.querySelectorAll('button, input, textarea, select, details')]
    .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.wave-scene'))
    .map(el => ({ tag: el.tagName, name: el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('id') ||
      (el instanceof HTMLInputElement ? [...(el.labels || [])].map(label => label.textContent?.trim()).join(' ') : '') ||
      (el.tagName === 'BUTTON' ? el.textContent?.trim() : el.getAttribute('type')),
      disabled: (el as HTMLButtonElement).disabled || false,
      open: el instanceof HTMLDetailsElement ? el.open : undefined,
      value: el instanceof HTMLSelectElement ? el.value : undefined })));
}

const pages = [
  ['/sandbox', '临时工作台'],
  ['/pipelines/standard', '文艺短视频'],
  ['/pipelines/action-transfer', '动作迁移'],
  ['/pipelines/digital-human', '数字人口播'],
  ['/settings', '设置'],
  ...['script_generation', 'character_design', 'storyboard', 'reference_generation', 'video_generation', 'post_production']
    .map((stage, i) => [`/?session=${stage === 'character_design' ? 'parity-role' : 'e2e-showcase'}&stage=${stage}`, ['剧本生成', '角色 / 场景设计', '分镜设计', '参考图生成', '视频生成', '后期剪辑'][i]]),
];
for (const [url, title] of pages) {
  test(`同源主题回归：${title}的控件顺序、默认状态与固定顶栏`, async ({ page, browser }) => {
    const legacy = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    try {
      await login(page);
      await login(legacy, legacyOrigin);
      for (const [target, origin] of [[page, ''], [legacy, legacyOrigin]] as const) {
        await target.goto(origin + url, { waitUntil: 'domcontentloaded' });
        await expect(target.locator('#main-content')).toContainText(title);
        await expect(target.locator('#main-content')).not.toContainText('正在加载');
        if (url === '/settings') await expect(target.getByRole('button', { name: '保存配置', exact: true })).toBeEnabled();
        const header = target.locator('.legacy-brand-header, .mj-topbar:not(.mj-topbar-home)');
        await expect(header).toBeVisible();
        await expect(header).toHaveCSS('position', 'fixed');
        await expect(header).toHaveCSS('height', '56px');
        await expect.poll(async () => (await header.boundingBox())?.x).toBe(248);
        await expect(target.locator('#main-content')).toHaveCSS('padding-left', '0px');
        await expect(target.locator('#main-content')).toHaveCSS('padding-top', '0px');
      }
      await expect(async () => {
        expect(await controls(page)).toEqual(await controls(legacy));
      }).toPass({ timeout: 10000 });
      // The tools share original forms, so check actual grouping positions as well as DOM order.
      if (!url.startsWith('/?')) {
        const geometry = async (target: Page) => target.locator('#main-content').evaluate(main =>
          [...main.querySelectorAll('h1, input:not([type="hidden"]), textarea, select')]
            .filter(el => el.getClientRects().length)
            .map(el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; }));
        await expect.poll(() => geometry(page)).toEqual(await geometry(legacy));
      }
    } finally { await legacy.close(); }
  });
}

test('左侧导航、两组任务和设置的布局在两种主题相同，收起展开及刷新保持', async ({ page, browser }) => {
  const legacy = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    await login(page);
    await login(legacy, legacyOrigin);
    const selectors = ['.mj-sidebar', '.mj-sidebar-nav', '.mj-task-panel:nth-of-type(1)', '.mj-task-panel:nth-of-type(2)', '.mj-sidebar-footer'];
    for (const selector of selectors) {
      expect(await page.locator(selector).boundingBox(), selector).toEqual(await legacy.locator(selector).boundingBox());
    }
    expect(await page.locator('.mj-sidebar-nav a').allTextContents()).toEqual(await legacy.locator('.mj-sidebar-nav a').allTextContents());
    await expect(page.locator('.live-header, .live-task-panels')).toHaveCount(0);
    await expect(page.locator('.wave-scene')).toBeVisible();
    await expect(page.locator('.mj-hero-title')).toContainText('故事的下一幕');
    await expect(page.locator('#main-content')).toHaveCSS('margin-left', '248px');
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect(page.locator('.mj-sidebar').getByRole('button', { name: '修改配置' })).toBeVisible();
    await expect(page.locator('.mj-sidebar').getByRole('button', { name: '清空缓存' })).toBeVisible();
    await page.getByRole('button', { name: '修改配置' }).click();
    await expect(page).toHaveURL('/settings');
    await expect(page.locator('#main-content').getByRole('button', { name: '清空缓存' })).toHaveCount(0);
    await page.getByRole('button', { name: '收起侧边栏' }).click();
    await expect(page.locator('.mj-sidebar')).toHaveCSS('width', '0px');
    await expect(page.locator('#main-content')).toHaveCSS('margin-left', '0px');
    await expect(page.getByRole('navigation', { name: '主导航' })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: '打开侧边栏' })).toBeVisible();
    await expect(page.locator('.mj-sidebar')).toHaveCSS('width', '0px');
    await page.getByRole('button', { name: '打开侧边栏' }).click();
    await expect(page.locator('#main-content')).toHaveCSS('margin-left', '248px');
    await page.reload();
    await expect(page.getByRole('button', { name: '收起侧边栏' })).toBeVisible();
    await page.goto('/');
    await page.screenshot({ path: '../.local-artifacts/sidebar-restored-desktop.png' });
  } finally { await legacy.close(); }
});

test('移动端默认收起、可展开并导航，不留下透明侧栏遮挡', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByRole('button', { name: '打开侧边栏' })).toBeVisible();
  await expect(page.locator('.mj-sidebar')).toHaveCSS('width', '0px');
  await expect(page.locator('#main-content')).toHaveCSS('margin-left', '0px');
  await page.getByRole('button', { name: '打开侧边栏' }).click();
  await expect(page.locator('.mj-sidebar')).toHaveCSS('width', '248px');
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: '临时工作台' }).click();
  await expect(page).toHaveURL('/sandbox');
  await page.screenshot({ path: '../.local-artifacts/sidebar-restored-mobile-open.png' });
  await page.getByRole('button', { name: '收起侧边栏' }).click();
  await expect(page.locator('.mj-sidebar')).toHaveCSS('width', '0px');
  await expect(page.locator('.legacy-brand-header')).toHaveCSS('left', '0px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: '../.local-artifacts/sidebar-restored-mobile-closed.png' });
});


test('登录页保留深色视觉且不引入侧栏', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: '管理员登录', exact: true })).toBeVisible();
  await expect(page.locator('.concept.live')).toHaveCSS('background-color', 'rgb(5, 5, 5)');
  await expect(page.locator('.mj-sidebar')).toHaveCount(0);
  await expect(page.locator('.live-main')).toHaveCSS('padding-left', '0px');
});


test('身份读取缓慢时等待就绪再显示登录表单，按钮可用', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/auth/me', async route => { await gate; await route.continue(); });
  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('正在验证访问权限…')).toBeVisible();
    await expect(page.getByRole('button', { name: '管理员登录', exact: true })).toHaveCount(0);
    release();
    await page.getByRole('button', { name: '管理员登录', exact: true }).click();
    await page.getByLabel('管理员密码').fill('e2e-admin-password');
    await expect(page.getByRole('button', { name: '进入幕间' })).toBeEnabled();
    await page.getByRole('button', { name: '进入幕间' }).click();
    await expect(page.locator('.mj-composer')).toBeVisible();
  } finally { release(); }
});

test('旧项目书签保留首页创作区，访客案例首屏直接可见', async ({ page, browser }) => {
  await login(page);
  await page.goto('/?view=projects');
  await expect(page.locator('.mj-composer')).toBeVisible();
  await expect(page.locator('.wave-scene')).toBeVisible();
  const guest = await browser.newPage();
  try {
    await guest.goto('http://127.0.0.1:18776/login?code=E2EDEMO2');
    await expect(guest).toHaveURL('http://127.0.0.1:18776/');
    await expect(guest.getByRole('heading', { name: '示例作品', exact: true })).toBeInViewport();
    await expect(guest.getByRole('button', { name: '演示短片：一封信' })).toBeInViewport();
    await expect(guest.locator('.wave-stage')).toHaveCount(0);
  } finally { await guest.close(); }
});
