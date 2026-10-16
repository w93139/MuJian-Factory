import { expect, test, type Page } from '@playwright/test';

async function admin(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '管理员登录', exact: true }).click();
  await page.getByLabel('管理员密码').fill('e2e-admin-password');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page).toHaveURL('/');
}

test('剧本正文结构编辑保存刷新，SSE失败和断流保留草稿', async ({ page }) => {
  await admin(page);
  await page.goto('/?session=parity-script&stage=script_generation');
  await page.getByRole('button', { name: '修改', exact: true }).click();
  const body = page.getByLabel('第 1 集正文', { exact: true });
  await expect(body).toHaveValue('原有第一集');
  await body.fill('手动修改的第一集正文');
  const endpoint = '**/api/project/parity-script/intervene';
  await page.route(endpoint, route => route.fulfill({ contentType: 'text/event-stream', body: '{"type":"error","content":"保存测试失败"}\n' }));
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByText('保存失败，草稿已保留，请重试', { exact: true })).toBeVisible();
  await expect(body).toHaveValue('手动修改的第一集正文');
  await page.unroute(endpoint);
  await page.route(endpoint, route => route.fulfill({ contentType: 'text/event-stream', body: '{"type":"progress","percent":10}\n' }));
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.locator('#main-content')).toContainText('阶段事件流提前结束');
  await expect(body).toHaveValue('手动修改的第一集正文');
  await page.unroute(endpoint);
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('button', { name: '修改', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('手动修改的第一集正文', { exact: true })).toBeVisible();
  const snapshot = await (await page.request.get('/api/project/parity-script/status')).json();
  expect(snapshot.artifacts.script_generation.episodes[0]).toMatchObject({ content: '手动修改的第一集正文', custom_script: 'keep', episode_number: 1 });
  expect(snapshot.artifacts.script_generation.episodes[1].content).toBe('原有第二集');
});

test('角色保存同步下游字段且保持waiting，连续卡片选版不互相覆盖', async ({ page }) => {
  await admin(page);
  await page.goto('/?session=parity-role&stage=character_design');
  const char = page.locator('[data-asset-id="c1"]');
  const setting = page.locator('[data-asset-id="s1"]');
  await char.getByRole('button', { name: '修改', exact: true }).click();
  await char.getByLabel('旅人描述').fill('新角色描述');
  await char.getByRole('button', { name: '保存', exact: true }).click();
  await expect(char.getByLabel('旅人描述')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '继续生成', exact: true })).toBeEnabled();
  await char.getByRole('button', { name: '选择版本 2', exact: true }).click();
  await setting.getByRole('button', { name: '选择版本 2', exact: true }).click();
  await expect(setting.getByRole('button', { name: '选择版本 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(char.getByRole('button', { name: '选择版本 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const saved = await (await page.request.get('/api/project/parity-role/status')).json();
  expect(saved.status.character_design).toBe('waiting');
  expect(saved.current_stage).toBe('character_design');
  expect(saved.artifacts.script_generation.characters[0].description).toBe('新角色描述');
  expect(saved.artifacts.character_design.characters[0].custom).toBe('keep');
  expect(saved.artifacts.character_design.characters[0].versions).toHaveLength(2);
  await page.reload();
  await expect(char.getByText('新角色描述', { exact: true })).toBeVisible();
  await expect(char.getByRole('button', { name: '选择版本 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await char.getByRole('button', { name: '修改', exact: true }).click();
  await char.getByLabel('旅人描述').fill('未保存草稿');
  await setting.getByRole('button', { name: '修改', exact: true }).click();
  await expect(char.getByLabel('旅人描述')).toHaveValue('未保存草稿');
});

test('角色保存失败保留描述和原选版，可以重试和清空描述', async ({ page }) => {
  await admin(page);
  await page.goto('/?session=parity-role-failure&stage=character_design');
  const char = page.locator('[data-asset-id="c1"]');
  const endpoint = '**/api/project/parity-role-failure/artifact/character_design';
  await page.route(endpoint, route => route.request().method() === 'PATCH' ? route.fulfill({ status: 500, json: { detail: '角色保存失败测试' } }) : route.continue());
  await char.getByRole('button', { name: '选择版本 2', exact: true }).click();
  await expect(page.locator('#main-content')).toContainText('角色保存失败测试');
  await expect(char.getByRole('button', { name: '选择版本 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(char.getByRole('button', { name: '选择版本 2', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await char.getByRole('button', { name: '修改', exact: true }).click();
  await char.getByLabel('旅人描述').fill('失败也保留的草稿');
  await char.getByRole('button', { name: '保存', exact: true }).click();
  await expect(char.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
  await expect(char.getByLabel('旅人描述')).toHaveValue('失败也保留的草稿');
  await page.unroute(endpoint);
  await char.getByLabel('旅人描述').fill('');
  await char.getByRole('button', { name: '保存', exact: true }).click();
  await expect(char.getByLabel('旅人描述')).toHaveCount(0);
  const saved = await (await page.request.get('/api/project/parity-role-failure/status')).json();
  expect(saved.artifacts.script_generation.characters[0].description).toBe('');
  expect(saved.artifacts.character_design.characters[0].description).toBe('');
});

test('浏览器前进后退和流水线历史选择保持URL与显示对应', async ({ page }) => {
  await admin(page);
  await page.locator('.mj-history-card').filter({ hasText: '演示短片：一封信' }).click();
  await expect(page).toHaveURL(/session=e2e-showcase/);
  await expect(page.getByRole('heading', { name: '后期剪辑', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.mj-composer')).toBeVisible();
  await expect(page.getByRole('heading', { name: '后期剪辑', exact: true })).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole('heading', { name: '后期剪辑', exact: true })).toBeVisible();
  await page.goto('/pipelines/standard?task=e2e-public-task');
  const video = page.locator('#main-content video').first();
  await expect(video).toHaveAttribute('src', /e2e-public-task/);
  await page.locator('#main-content').getByText('私有流水线草稿', { exact: true }).click();
  await expect(page).toHaveURL(/task=e2e-private-task/);
  await expect(video).toHaveAttribute('src', /e2e-private-task/);
  await page.goBack();
  await expect(video).toHaveAttribute('src', /e2e-public-task/);
  await page.goForward();
  await expect(video).toHaveAttribute('src', /e2e-private-task/);
});

test('首次创建流水线任务立即进入历史列表，无模型调用', async ({ page }) => {
  await admin(page);
  const task = { task_id: 'parity-new-task', pipeline: 'standard', status: 'completed', progress: 100, input: { title: '新任务历史测试' } };
  let started = false;
  await page.route('**/api/tasks?*', route => route.fulfill({ json: { tasks: started ? [task] : [] } }));
  await page.route('**/api/pipelines/standard/tasks', route => { started = true; return route.fulfill({ json: { task_id: task.task_id } }); });
  await page.route('**/api/tasks/parity-new-task', route => route.fulfill({ json: task }));
  await page.goto('/pipelines/standard');
  await page.getByPlaceholder('输入主题、观点或故事灵感，系统会先构思成完整旁白...').fill('只测试历史刷新');
  await page.getByRole('button', { name: '启动任务', exact: true }).click();
  await expect(page).toHaveURL(/task=parity-new-task/);
  await expect(page.locator('#main-content').getByText('新任务历史测试', { exact: true })).toBeVisible();
  expect(started).toBeTruthy();
});

test('全局任务入口和缓存成功失败反馈，移动布局与访客权限', async ({ page }) => {
  await admin(page);
  await page.goto('/settings');
  const panels = page.getByRole('complementary', { name: '侧边栏' });
  await expect(panels.getByText('进行中任务', { exact: true })).toBeVisible();
  await expect(panels.getByText('已完成/等待确认', { exact: true })).toBeVisible();
  await expect(panels.getByRole('button').filter({ hasText: '公开流水线示例' })).toBeVisible();
  let calls = 0;
  await page.route('**/api/cache/temp', route => {
    expect(route.request().method()).toBe('DELETE'); calls++;
    return calls === 1 ? route.fulfill({ status: 500, json: { detail: '缓存清理失败测试' } }) : route.fulfill({ json: { status: 'ok', deleted: 2, freed_mb: 1 } });
  });
  const messages: string[] = [];
  page.on('dialog', async dialog => { messages.push(dialog.message()); await dialog.accept(); });
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '清空缓存', exact: true }).click();
  await expect.poll(() => messages[0]).toContain('缓存清理失败测试');
  await page.getByRole('button', { name: '清空缓存', exact: true }).click();
  await expect.poll(() => messages[1]).toContain('缓存已清空');
  expect(calls).toBe(2);
  await page.getByRole('button', { name: '收起侧边栏' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.legacy-brand-header')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  await page.screenshot({ path: '../.local-artifacts/parity-settings-mobile.png', fullPage: true });
  await page.unroute('**/api/cache/temp');
  await page.getByRole('button', { name: '打开侧边栏' }).click();
  await page.getByRole('button', { name: '退出', exact: true }).click();
  await page.goto('/login?code=E2EDEMO2');
  await expect(page).toHaveURL('/');
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: '清空缓存', exact: true })).toHaveCount(0);
  expect((await page.request.delete('/api/cache/temp')).status()).toBe(403);
});

test('全局面板保留六阶段完成、待确认和沙盒任务跳转', async ({ page }) => {
  await admin(page);
  const completed = Object.fromEntries(['script_generation', 'character_design', 'storyboard', 'reference_generation', 'video_generation', 'post_production'].map(stage => [stage, 'completed']));
  await page.route('**/api/sessions', route => route.fulfill({ json: { sessions: [
    { id: 'e2e-showcase', title: '六阶段完成测试', status: completed },
    { id: 'parity-role', title: '角色等待确认测试', status: { character_design: 'waiting' } },
  ] } }));
  await page.route('**/api/sandbox/tasks', route => route.fulfill({ json: { tasks: [{ id: 'sandbox-parity', tool: 't2i', status: 'running', input: { prompt: '沙盒运行任务测试' } }] } }));
  await page.goto('/settings');
  const panels = page.getByRole('complementary', { name: '侧边栏' });
  await expect(panels.getByRole('button').filter({ hasText: '六阶段完成测试' })).toBeVisible();
  await panels.getByRole('button').filter({ hasText: '角色等待确认测试' }).click();
  await expect(page).toHaveURL(/session=parity-role&stage=character_design/);
  await expect(page.locator('[data-asset-id="c1"]')).toBeVisible();
  await panels.getByRole('button').filter({ hasText: '六阶段完成测试' }).click();
  await expect(page).toHaveURL(/session=e2e-showcase&stage=post_production/);
  await expect(page.getByRole('heading', { name: '后期剪辑', exact: true })).toBeVisible();
  await panels.getByRole('button').filter({ hasText: '沙盒运行任务测试' }).click();
  await expect(page).toHaveURL(/sandbox\?task=sandbox-parity/);
  await expect(page.locator('#main-content')).toContainText('临时工作台');
});

test('切换任务后迟到的SSE刷新不覆盖当前结果，读取失败清空旧结果', async ({ page }) => {
  await admin(page);
  const a = { task_id: 'slow-a', pipeline: 'standard', status: 'running', input: { title: '运行任务A' }, artifacts: [{ kind: 'video', path: '/code/result/task/slow-a/final.mp4' }] };
  const b = { task_id: 'fast-b', pipeline: 'standard', status: 'completed', input: { title: '完成任务B' }, artifacts: [{ kind: 'video', path: '/code/result/task/fast-b/final.mp4' }] };
  const c = { task_id: 'missing-c', pipeline: 'standard', status: 'completed', input: { title: '不存在任务C' } };
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/tasks?*', route => route.fulfill({ json: { tasks: [a, b, c] } }));
  await page.route('**/api/tasks/slow-a', async route => { if (++calls > 1) await gate; await route.fulfill({ json: a }); });
  await page.route('**/api/tasks/slow-a/events', route => route.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"artifact","task_id":"slow-a"}\n\n' }));
  await page.route('**/api/tasks/fast-b', route => route.fulfill({ json: b }));
  await page.route('**/api/tasks/missing-c', route => route.fulfill({ status: 404, json: { detail: 'not found' } }));
  try {
    await page.goto('/pipelines/standard?task=slow-a');
    await expect.poll(() => calls).toBeGreaterThan(1);
    await page.locator('#main-content').getByText('完成任务B', { exact: true }).click();
    await expect(page).toHaveURL(/task=fast-b/);
    const video = page.locator('#main-content video').first();
    await expect(video).toHaveAttribute('src', /fast-b/);
    const late = page.waitForResponse(response => response.url().endsWith('/api/tasks/slow-a'));
    release();
    await (await late).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(video).toHaveAttribute('src', /fast-b/);
    await page.locator('#main-content').getByText('不存在任务C', { exact: true }).click();
    await expect(page.locator('#main-content')).toContainText('获取任务状态失败');
    await expect(page.locator('#main-content video')).toHaveCount(0);
    await page.locator('#main-content').getByText('完成任务B', { exact: true }).click();
    await expect(video).toHaveAttribute('src', /fast-b/);
    await expect(page.locator('#main-content')).not.toContainText('获取任务状态失败');
  } finally { release(); }
});

test('历史项目加载期间快速后退前进仍完整恢复', async ({ page }) => {
  await admin(page);
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/project/e2e-showcase/status', async route => {
    if (++calls === 1) await gate;
    await route.continue();
  });
  try {
    await page.locator('.mj-history-card').filter({ hasText: '演示短片：一封信' }).click();
    await expect(page).toHaveURL(/session=e2e-showcase/);
    await expect.poll(() => calls).toBe(1);
    await page.goBack();
    await expect(page).toHaveURL('/');
    await page.goForward();
    await expect.poll(() => calls).toBeGreaterThan(1);
    await expect(page.getByRole('heading', { name: '后期剪辑', exact: true })).toBeVisible();
    const late = page.waitForResponse(response => response.url().endsWith('/api/project/e2e-showcase/status'));
    release();
    await (await late).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByRole('heading', { name: '后期剪辑', exact: true })).toBeVisible();
  } finally { release(); }
});
