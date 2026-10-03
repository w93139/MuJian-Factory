import { expect, test, type Page } from '@playwright/test';

const demoTitle = '演示短片：一封信';

async function guestLogin(page: Page) {
  await page.goto('/login?code=E2EDEMO2');
  await expect(page).toHaveURL('/');
  await expect(page.getByText('展示模式：仅可浏览示例作品')).toBeVisible();
}

async function openShowcase(page: Page) {
  await guestLogin(page);
  await page.getByRole('button', { name: demoTitle }).click();
  await expect(page).toHaveURL(/session=e2e-showcase/);
  await expect(page.getByRole('heading', { name: demoTitle })).toBeVisible();
}

test('匿名访问工作页会转到登录页', async ({ page }) => {
  await page.goto('/sandbox');
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('button', { name: '进入幕间' })).toBeVisible();
});

test('邀请码登录后只看到公开的示例作品', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '邀请码' }).fill('E2EDEMO2');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: demoTitle })).toBeVisible();
  await expect(page.getByText('私有草稿')).toHaveCount(0);
});

test('示例作品六阶段均可查看并显示图片与视频', async ({ page }) => {
  await openShowcase(page);
  const stages = [
    ['剧本', '剧本占位'],
    ['角色', '角色占位'],
    ['分镜', '分镜占位'],
    ['参考图', '参考图占位'],
    ['视频', '视频片段占位'],
    ['成片', '成片占位'],
  ] as const;
  for (const [stage, content] of stages) {
    await page.getByRole('button', { name: new RegExp(`^${stage}`) }).click();
    await expect(page.locator('pre')).toContainText(content);
  }
  await expect(page.locator('video')).toHaveCount(1);
});

test('面试官只读界面没有生成、修改、删除入口，接口也拒绝写入', async ({ page }) => {
  await openShowcase(page);
  for (const name of ['快速演示', '创建项目', '重新生成', '删除', '修改配置']) {
    await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
  }
  await expect(page.getByRole('link', { name: '设置' })).toHaveCount(0);
  const writeResult = await page.evaluate(async () => {
    const response = await fetch('/api/project/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    return response.status;
  });
  expect(writeResult).toBe(403);
  const privateResult = await page.evaluate(async () => (await fetch('/api/sessions/e2e-private')).status);
  expect(privateResult).toBe(404);
});

test('管理员登录后可打开设置与邀请码面板', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '管理员登录' }).click();
  await page.getByRole('textbox', { name: '管理员密码' }).fill('e2e-admin-password');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '面试官邀请码' })).toBeVisible();
  await expect(page.getByText('E2EDEMO2')).toBeVisible();
});

test('面试官可打开首页、沙盒及三条流水线历史页', async ({ page }) => {
  await guestLogin(page);
  const routes = [
    ['/', '示例作品', '/api/sessions'],
    ['/sandbox', '临时工作台历史', '/api/sandbox/history'],
    ['/pipelines/standard', '文艺短视频历史', '/api/tasks?limit=100'],
    ['/pipelines/action-transfer', '动作迁移历史', '/api/tasks?limit=100'],
    ['/pipelines/digital-human', '数字人口播历史', '/api/tasks?limit=100'],
  ] as const;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [route, title, apiPath] of routes) {
    const apiResponse = page.waitForResponse(response => response.url().includes(apiPath));
    await page.goto(route);
    expect((await apiResponse).status()).toBe(200);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.locator('.mj-shell [role="alert"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /生成|修改|上传|删除/ })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('示例媒体由已登录会话读取', async ({ page }) => {
  await guestLogin(page);
  const image = await page.request.get('/code/result/e2e-showcase/image.png');
  const video = await page.request.get('/code/result/e2e-showcase/video.mp4');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/png');
  expect(video.status()).toBe(200);
  expect(video.headers()['content-type']).toContain('video/mp4');
});
