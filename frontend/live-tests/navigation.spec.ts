import { test, expect } from '@playwright/test';

test('正式光影入口保留参数、工具与移动端布局', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '管理员登录', exact: true }).click();
  await page.getByLabel('管理员密码').fill('e2e-admin-password');
  await page.getByRole('button', { name: '进入幕间' }).click();
  await expect(page).toHaveURL('/');
  await page.getByText('创作参数', { exact: true }).click();
  await expect(page.getByLabel('视频模型', { exact: true })).toBeVisible();
  await page.getByLabel('故事创意', { exact: true }).fill('只检查表单，不启动生成');
  await expect(page.getByRole('button', { name: '创建项目', exact: true })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('视频模型', { exact: true })).toBeVisible();
  await page.screenshot({ path: '../.local-artifacts/cleanup-home-mobile.png', fullPage: true });
  const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].map(el => ({ className: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right })).filter(el => el.right > innerWidth + 1).slice(0, 12));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), JSON.stringify(overflow)).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 });
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
  await page.goto('/?session=live-edit&stage=script_generation');
  await page.getByText('故事方向与创作模式', { exact: true }).click();
  await expect(page.getByText(/模式尚未实现/)).toBeVisible();
  await expect(page.getByRole('button', { name: '电影 movie', exact: true })).toHaveCount(0);
});
