import { expect, test, type Page } from '@playwright/test';

async function adminLogin(page: Page) {
  await page.goto('/login');
  await page.getByRole('button', { name: '管理员登录' }).click();
  await page.getByRole('textbox', { name: '管理员密码' }).fill('e2e-admin-password');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page).toHaveURL('/');
}

test('沙盒真实模型能力约束控件并提交视频参数 模拟生成结果', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/sandbox');
  await page.getByRole('button', { name: '视频生成 图生视频/文生视频' }).click();
  const model = page.locator('select').first();
  await expect(model.locator('option[value="doubao-seedance-2-0-fast-260128"]')).toHaveCount(1);
  await expect(model.locator('option[value="happyhorse-1.0-video-edit"]')).toHaveCount(0);
  await expect(model.locator('option[value="wan2.7-r2v"]')).toHaveCount(0);
  await model.selectOption('doubao-seedance-2-0-fast-260128');
  await expect(page.getByLabel('分辨率').locator('option')).toHaveText(['480p', '720p']);
  await page.getByLabel('画幅', { exact: true }).selectOption('9:16');
  await page.getByLabel('分辨率', { exact: true }).selectOption('720p');
  await page.getByLabel('时长 秒', { exact: true }).fill('8');
  await page.getByRole('button', { name: 'URL 地址' }).click();
  await page.getByPlaceholder('https://example.com/image.jpg').fill('http://127.0.0.1:18766/code/result/image/e2e-showcase/image.png');
  await page.locator('textarea').fill('隔离测试');
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/sandbox/video', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { success: true, video_path: '/code/result/video/e2e-showcase/video.mp4', parameters: { ratio: '9:16', resolution: '720p', duration: 8 } } });
  });
  await page.getByRole('button', { name: '生成', exact: true }).click();
  await expect(page.getByText('实际参数 画幅 9:16 · 分辨率 720p · 时长 秒 8')).toBeVisible();
  expect(submitted).toMatchObject({ ratio: '9:16', resolution: '720p', duration: 8, model: 'doubao-seedance-2-0-fast-260128' });
});

test('沙盒图片仅启用实际适配分辨率并显示真实接口错误', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/sandbox');
  await page.getByRole('button', { name: '文生图 文字生成图片' }).click();
  const model = page.locator('select').first();
  await expect(model.locator('option[value="wan2.7-image"]')).toHaveCount(1);
  await model.selectOption('wan2.7-image');
  await expect(page.getByLabel('分辨率').locator('option')).toHaveText(['2K']);
  await expect(page.getByText('部分注册分辨率尚未接入当前图片适配器或不适用于此工具 暂不可选')).toBeVisible();
  await page.locator('textarea').fill('隔离测试');
  await page.route('**/api/sandbox/t2i', route => route.fulfill({ status: 422, json: { detail: '隔离测试参数被拒绝' } }));
  await page.getByRole('button', { name: '生成', exact: true }).click();
  await expect(page.getByText('隔离测试参数被拒绝')).toBeVisible();
});

test('文艺短视频沿用真实模板 字幕 配音 动态参数控件', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/pipelines/standard');
  await page.getByRole('button', { name: '生成配置' }).click();
  await expect(page.getByLabel('视频分辨率')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '图片模型', exact: true }).locator('option')).not.toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '视频比例', exact: true }).locator('option[value="21:9"]')).toHaveCount(0);
  await expect(page.getByText('完整文案按句号分段 配音始终开启 图片拼接成片时长随配音确定')).toBeVisible();
  await page.getByRole('button', { name: '完整文案', exact: true }).click();
  await page.getByPlaceholder('输入完整旁白文案，系统会按句号切分片段并直接进入 TTS...').fill('第一句。第二句。');
  await page.getByRole('button', { name: '使用精品模版' }).click();
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/pipelines/standard/tasks', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 422, json: { detail: '生成拦截 仅验证提交契约' } });
  });
  await page.getByRole('button', { name: '启动任务' }).click();
  await expect(page.getByText('生成拦截 仅验证提交契约')).toBeVisible();
  expect(submitted?.subtitle_template).toMatch(/^\d+x\d+\/.+\.html$/);
  expect(submitted).toMatchObject({ enable_subtitles: true, template_media_kind: 'image', tts_voice: 'zh-CN-YunjianNeural', tts_speed: 1 });
  expect(submitted).not.toHaveProperty('n_scenes');
  expect(submitted).not.toHaveProperty('generate_audio');
});

test('文艺动态视频提交受模型约束的时长与分辨率', async ({ page }) => {
  await adminLogin(page);
  await page.goto('/pipelines/standard');
  await page.getByRole('button', { name: '动态视频', exact: true }).click();
  await page.getByRole('button', { name: '生成配置' }).click();
  await page.getByPlaceholder('输入主题、观点或故事灵感，系统会先构思成完整旁白...').fill('隔离验证');
  const videoModel = page.getByRole('combobox', { name: '视频模型', exact: true });
  await expect(videoModel.locator('option[value="doubao-seedance-2-0-fast-260128"]')).toHaveCount(1);
  await videoModel.selectOption('doubao-seedance-2-0-fast-260128');
  await expect(page.getByLabel('视频分辨率').locator('option')).toHaveText(['480p', '720p']);
  await page.getByLabel('视频分辨率').selectOption('720p');
  await page.getByLabel('最低视频时长 秒').fill('8');
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/pipelines/standard/tasks', async route => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 422, json: { detail: '生成拦截 动态参数验证' } });
  });
  await page.getByRole('button', { name: '启动任务' }).click();
  await expect(page.getByText('生成拦截 动态参数验证')).toBeVisible();
  expect(submitted).toMatchObject({ video_mode: 'dynamic_video', video_duration: 8, video_resolution: '720p', video_model: 'doubao-seedance-2-0-fast-260128' });
});
