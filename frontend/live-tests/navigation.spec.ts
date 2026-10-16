import { test, expect } from '@playwright/test';

test('正式光影入口保留参数、工具与移动端布局', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '管理员登录', exact: true }).click();
  await page.getByLabel('管理员密码').fill('e2e-admin-password');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page).toHaveURL('/');
  // 原版配置是按钮控制的折叠面板，保留其默认关闭状态。
  await expect(page.locator('.mj-generation-panel')).toHaveCount(0);
  await page.getByRole('button', { name: '生成配置', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '视频生成方式', exact: true })).toBeVisible();
  await page.getByPlaceholder('描述你的想法，输入一段故事、一个画面或一句灵感……').fill('只检查表单，不启动生成');
  await expect(page.getByRole('button', { name: '逐步创作', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '一键生成', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '快速演示（约 30 秒成片）', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('combobox', { name: '视频生成方式', exact: true })).toBeVisible();
  await page.screenshot({ path: '../.local-artifacts/cleanup-home-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].map(el => ({ className: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })).filter(el => el.right > innerWidth + 1).slice(0, 12));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(overflow)).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?session=live-edit&stage=storyboard');
  await expect(page.getByRole('heading', { name: '分镜设计', exact: true })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('link', { name: '创作首页', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('.mj-composer')).toBeVisible();
  await expect(page.getByRole('heading', { name: '分镜设计', exact: true })).toHaveCount(0);
  await navigation.getByRole('link', { name: '我的项目', exact: true }).click();
  await expect(page).toHaveURL('/?view=projects');
  await expect(page.locator('.mj-history')).toBeVisible();
  await expect(page.locator('.mj-history-card').first()).toBeVisible();
  await expect(page.locator('.mj-composer')).toBeHidden();

  for (const [url, text, name] of [
    ['/sandbox', '临时工作台', 'sandbox'],
    ['/pipelines/standard', '文艺短视频', 'standard'],
    ['/settings', '设置', 'settings'],
  ]) {
    await page.goto(url);
    await expect(page.locator('#main-content')).toContainText(text);
    await expect(page.locator('#main-content')).not.toContainText('正在读取身份');
    await page.screenshot({ path: `../.local-artifacts/cleanup-${name}.png`, fullPage: true });
  }
  // 入口应直接可见；独立运行本测试时先确认已存在的草稿，不调用模型。
  await page.goto('/?session=live-continue&stage=script_generation');
  const draftButton = page.getByRole('button', { name: '保存新剧集', exact: true });
  await expect(page.getByRole('button', { name: /^(保存新剧集|智能续写)$/ }).first()).toBeVisible();
  if (await draftButton.count()) await draftButton.click();
  const continueButton = page.getByRole('button', { name: '智能续写', exact: true });
  await expect(continueButton).toBeVisible();
  await expect(page.locator('details').filter({ hasText: /智能续写|故事方向与创作模式/ })).toHaveCount(0);
  await expect(page.getByText(/模式尚未实现/)).toHaveCount(0);
  await continueButton.click();
  await expect(page.getByRole('heading', { name: '智能续写设置', exact: true })).toBeVisible();
  for (const name of ['1 集', '2 集', '3 集']) {
    await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: '确认生成', exact: true })).toBeVisible();
  // 只验证既有弹窗，不发起付费生成。
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('heading', { name: '智能续写设置', exact: true })).toHaveCount(0);
});

test('新建自动项目后同址返回首页和切换阶段保留控制器状态', async ({ page }) => {
  // 生成相关请求全部截获；仅登录使用隔离后端，不调用任何模型。
  const sid = 'navigation-only';
  const model = 'navigation-test-model';
  const stages = ['script_generation', 'character_design', 'storyboard', 'reference_generation', 'video_generation', 'post_production'];
  const artifacts = {
    script_generation: { title: '导航测试故事', logline: '导航测试', episodes: [{ episode_number: 1, act_title: '第一集', content: '仅测试导航' }] },
    storyboard: { episodes: [{ episode_number: 1, episode_title: '第一集', segments: [] }] },
  };
  let starts = 0;
  let executions = 0;
  await page.route('**/api/models?**', route => route.fulfill({ json: {
    models: [{ id: model, label: '导航测试模型', provider: 'test' }], quick_demo_video_model: model,
  } }));
  await page.route('**/api/config', route => route.fulfill({ json: { config: {
    models: { llm: model, vlm: model, image_t2i: model, image_it2i: model, video_first_frame: model, video_start_end: model, video_reference: model },
    generation: { video_ratio: '16:9', video_resolution: '720P', video_generation_mode: 'first_frame' },
  } } }));
  await page.route(`**/api/project/${sid}/**`, async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/status')) {
      await route.fulfill({ json: { session_id: sid, current_stage: 'script_generation',
        status: Object.fromEntries(stages.map(stage => [stage, stage === 'script_generation' ? 'waiting' : 'pending'])), artifacts,
      } });
    } else if (pathname.includes('/artifact/')) {
      const stage = pathname.split('/').pop() as keyof typeof artifacts;
      await route.fulfill({ json: { artifact: artifacts[stage] || null } });
    } else if (pathname.includes('/execute/')) {
      executions += 1;
      expect(pathname.endsWith('/execute/script_generation')).toBe(true);
      expect(route.request().postDataJSON().auto_mode).toBe(true);
      await route.fulfill({ contentType: 'text/event-stream', body: JSON.stringify({ type: 'stage_complete', requires_intervention: true }) + '\n' });
    } else {
      // 未预期的续跑必须被阻止，不转发到后端。
      await route.fulfill({ status: 400, json: { detail: '导航测试不允许额外生成请求' } });
    }
  });
  await page.route('**/api/project/start', async route => {
    starts += 1;
    await route.fulfill({ json: { session_id: sid, status: 'created', params: route.request().postDataJSON() } });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: '管理员登录', exact: true }).click();
  await page.getByLabel('管理员密码').fill('e2e-admin-password');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page).toHaveURL('/');
  await page.getByPlaceholder('描述你的想法，输入一段故事、一个画面或一句灵感……').fill('新建项目导航检查');
  await page.getByRole('button', { name: '一键生成', exact: true }).click();
  await expect(page.getByRole('heading', { name: '剧本生成', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '自动', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '停止', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL('/');

  const navigation = page.getByRole('navigation', { name: '主导航' });
  await navigation.getByRole('link', { name: '创作首页', exact: true }).click();
  await expect(page.locator('.mj-composer')).toBeVisible();
  await expect(page.getByRole('heading', { name: '剧本生成', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '自动', exact: true })).toBeVisible();

  // 第一次阶段切换写入 session URL，也不应卸载并重置自动模式。
  await page.getByRole('button', { name: '分镜', exact: true }).click();
  await expect(page).toHaveURL(`/?session=${sid}&stage=storyboard`);
  await expect(page.getByRole('heading', { name: '分镜设计', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '自动', exact: true })).toBeVisible();
  await navigation.getByRole('link', { name: '创作首页', exact: true }).click();
  await expect(page.locator('.mj-composer')).toBeVisible();
  await expect(page.getByRole('button', { name: '自动', exact: true })).toBeVisible();
  expect(starts).toBe(1);
  expect(executions).toBe(1);
});
