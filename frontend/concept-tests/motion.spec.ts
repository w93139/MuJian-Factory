import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import path from 'node:path';
const sha=(data:Buffer)=>createHash('sha256').update(data).digest('hex');
test('主视觉真实动画、暂停、减少动态与手机操作',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/');await expect(page.locator('.loading-state')).toHaveCount(0);
 const selector=info.project.name==='director'?'.wave-scene':info.project.name==='guided'?'.cubes-visual':'.film-ribbon';
 const scene=page.locator(selector);await scene.scrollIntoViewIfNeeded();await expect(scene).toHaveAttribute('data-motion','active');
 const target=info.project.name==='director'?scene.locator('canvas'):info.project.name==='guided'?scene.locator('.default-animation'):scene;
 if(info.project.name==='director')await expect(scene.locator('.threads-container')).toHaveAttribute('data-renderer','webgl');
 if(info.project.name==='guided')await expect(scene.locator('.cube')).toHaveCount(36);
 const first=await target.screenshot();await page.waitForTimeout(500);const second=await target.screenshot();expect(sha(second)).not.toBe(sha(first));
 await scene.getByRole('button',{name:'暂停主视觉动效',exact:true}).click();await expect(scene).toHaveAttribute('data-motion','paused');
 // Allow the last paint to complete; subsequent frames should be identical.
 await page.waitForTimeout(180);const stopped1=await target.screenshot();await page.waitForTimeout(350);const stopped2=await target.screenshot();expect(sha(stopped2)).toBe(sha(stopped1));
 if(info.project.name==='director'){
  const box=await scene.boundingBox();if(!box)throw new Error('missing motion field');await page.mouse.move(box.x+30,box.y+30);await page.waitForTimeout(150);const still=await target.screenshot();expect(sha(still)).toBe(sha(stopped1));
 }
 await scene.getByRole('button',{name:'播放主视觉动效',exact:true}).click();await expect(scene).toHaveAttribute('data-motion','active');
 await page.emulateMedia({reducedMotion:'reduce'});await expect(scene).toHaveAttribute('data-motion','paused');await expect(scene.locator('.motion-toggle')).toBeDisabled();
 const static1=await target.screenshot();await page.waitForTimeout(300);const static2=await target.screenshot();expect(sha(static1)).toBe(sha(static2));
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.locator('.loading-state')).toHaveCount(0);
 const mobileScene=page.locator(selector);await mobileScene.scrollIntoViewIfNeeded();await mobileScene.getByRole('button',{name:'暂停主视觉动效',exact:true}).click();await expect(mobileScene).toHaveAttribute('data-motion','paused');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:path.resolve('../screenshots',info.project.name+'-motion-mobile.png'),fullPage:true});
});
test('新首页入口、海报与图形交互保持真实去向',async({page},info)=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('.loading-state')).toHaveCount(0);
 if(info.project.name==='gallery'){
  await page.getByRole('button',{name:'展示海报 山水之间',exact:true}).click();await expect(page.locator('.poster-title h2')).toHaveText('山水之间');await expect(page.locator('.editorial-poster>a')).toHaveAttribute('href','/?session=demo-ink&stage=post_production');
  await page.getByRole('link',{name:'开启你的下一幕'}).click();await expect(page.getByRole('textbox',{name:'故事创意'})).toBeInViewport();
 }else if(info.project.name==='guided'){
  await expect(page.locator('.module-tool-row a')).toHaveCount(4);await page.locator('.module-tool-row').getByRole('link',{name:/动作迁移/}).click();await expect(page).toHaveURL(/pipelines\/action-transfer/);
 }else{
  await expect(page.locator('.wave-stage .starter-links a')).toHaveCount(4);await page.locator('.wave-stage .starter-links').getByRole('link',{name:/数字人口播/}).click();await expect(page).toHaveURL(/pipelines\/digital-human/);
 }
});
