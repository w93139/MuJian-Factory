import {test,expect} from '@playwright/test';
import path from 'node:path';
import {existsSync} from 'node:fs';
test('对比页动态、静态、视口及状态切换',async({page},info)=>{
 test.skip(!existsSync(path.resolve('../comparison.html')) || !existsSync(path.resolve('../screenshots/gallery-home-mobile.png')), '历史对比截图为本地生成文件；先运行三版页面截图测试后再检验对比页');
 await page.goto('/comparison.html');await expect(page).toHaveTitle(/第三轮/);
 const frames=page.locator('iframe');await expect(frames).toHaveCount(3);
 for(let i=0;i<3;i++){
  await expect(frames.nth(i)).toHaveAttribute('src','http://127.0.0.1:'+(3101+i)+'/');
  await expect(page.frameLocator('iframe').nth(i).locator('.loading-state')).toHaveCount(0);
  await expect(page.frameLocator('iframe').nth(i).locator('h1')).toBeVisible();
 }
 await page.locator('[data-size=mobile]').click();await expect(frames.first()).toHaveCSS('width','390px');
 await page.locator('[data-mode=static]').click();for(let i=0;i<3;i++)await expect(frames.nth(i)).not.toHaveAttribute('src');
 await expect.poll(()=>page.locator('.snapshot img').evaluateAll(imgs=>imgs.every(img=>(img as HTMLImageElement).naturalWidth===390))).toBe(true);
 await page.locator('#page').selectOption('state-error');await expect(page.locator('[data-mode=live]')).toBeDisabled();
 await expect.poll(()=>page.locator('.snapshot img').evaluateAll(imgs=>imgs.every(img=>(img as HTMLImageElement).naturalWidth===1440))).toBe(true);
 await page.locator('#page').selectOption('home');await page.locator('[data-size=desktop]').click();await page.locator('[data-mode=live]').click();
 for(let i=0;i<3;i++)await expect(page.frameLocator('iframe').nth(i).locator('h1')).toBeVisible();
 if(info.project.name==='director')await page.screenshot({path:path.resolve('../comparison-preview.png'),fullPage:true});
});
