import { expect, test } from '@playwright/test';

test('新增官方模型进入原选择器，正式配音参数按所选音色提交', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '管理员登录', exact: true }).click();
  await page.getByLabel('管理员密码').fill('e2e-admin-password');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page).toHaveURL('/');
  const models = await page.request.get('/api/models?model_type=t2i');
  expect((await models.json()).models.some((item: { id: string }) => item.id === 'qwen-image-3.0-pro')).toBeTruthy();
  const videos = await page.request.get('/api/models?model_type=video');
  expect((await videos.json()).models.some((item: { id: string }) => item.id === 'doubao-seedance-2-5-260628')).toBeTruthy();
  await page.goto('/pipelines/digital-human');
  await page.getByRole('button', { name: '生成配置', exact: true }).click();
  const tts = page.getByRole('combobox', { name: '配音模型', exact: true });
  await expect(tts).toHaveValue('edge-tts');
  await tts.selectOption('qwen-audio-3.1-tts-plus');
  await expect(page.getByRole('combobox', { name: 'TTS 声音', exact: true })).toHaveValue('xunanchuan_v3.1');
  await page.getByRole('combobox', { name: 'TTS 声音', exact: true }).selectOption('longanhuan_v3.1');
  await page.locator('input[placeholder="/path/to/person.png"]').fill('/synthetic/person.png');
  await page.locator('textarea[placeholder="输入口播文案..."]').fill('你好，这是接口测试。');
  await page.route('**/api/pipelines/digital_human/tasks', async route => {
    const body = route.request().postDataJSON();
    expect(body.tts_model).toBe('qwen-audio-3.1-tts-plus');
    expect(body.tts_voice).toBe('longanhuan_v3.1');
    await route.fulfill({ status: 400, json: { detail: '已拦截收费调用，仅验证参数' } });
  });
  await page.getByRole('button', { name: '启动任务', exact: true }).click();
  await expect(page.getByText('已拦截收费调用，仅验证参数')).toBeVisible();
  await tts.selectOption('edge-tts');
  await expect(page.getByRole('combobox', { name: 'TTS 声音', exact: true }).locator('option[value="xunanchuan_v3.1"]')).toHaveCount(0);
});
