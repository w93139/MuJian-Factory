import { expect, test } from '@playwright/test';

test('沙盒历史在模型目录延迟加载及刷新后保留原模型和生成参数', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '管理员登录', exact: true }).click();
  await page.getByLabel('管理员密码').fill('e2e-admin-password');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page).toHaveURL('/');
  const model = 'doubao-seedream-5-0-flash-260915';
  const record = {
    id: 'history-restore-check', tool: 't2i', model,
    input: { prompt: '历史参数恢复检查', ratio: '9:16', resolution: '2K' },
    output: { images: ['result/image/e2e-showcase/image.png'] },
    created_at: '2026-10-16T17:32:00',
  };
  await page.route('**/api/sandbox/history', route => route.fulfill({ json: { success: true, records: [record] } }));
  for (const reload of [false, true]) {
    let release!: () => void;
    const ready = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/models?**', async route => {
      const response = await route.fetch();
      await ready;
      await route.fulfill({ response });
    });
    if (reload) await page.reload();
    else await page.goto('/sandbox?record=history-restore-check');
    await expect(page.getByText('实际参数 画幅 9:16 · 分辨率 2K')).toBeVisible();
    release();
    await expect(page.locator('select').first().locator(`option[value="${model}"]`)).toHaveCount(1);
    await expect(page.locator('select').first()).toHaveValue(model);
    await expect(page.getByLabel('画幅', { exact: true })).toHaveValue('9:16');
    await expect(page.getByLabel('分辨率', { exact: true })).toHaveValue('2K');
    await expect(page.locator('textarea')).toHaveValue(record.input.prompt);
    await page.unroute('**/api/models?**');
  }
});
