import { expect, test } from '@playwright/test';

test('selects a character, opens the panel, saves salary and restores settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '小祖' }).click();
  const pet = page.getByRole('button', { name: '桌宠信息' });
  const panel = page.getByRole('region', { name: '工资面板' });
  await expect(panel).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/web-pet.png' });
  await pet.click();
  await expect(panel).toBeVisible();
  await expect(page.getByRole('status', { name: '桌宠对话' })).toBeVisible();
  await expect(panel).toHaveCSS('animation-name', 'panel-arrive');
  await panel.getByRole('button', { name: '设置' }).click();
  await page.getByLabel('薪资金额').fill('4200');
  await page.getByRole('combobox', { name: '时区' }).selectOption('Asia/Shanghai');
  await page.getByRole('combobox', { name: '上班 HH', exact: true }).selectOption('08');
  await page.screenshot({ path: 'artifacts/product-settings.png', animations: 'disabled' });
  await page.getByRole('button', { name: '保存' }).click();
  await page.screenshot({ path: 'artifacts/web-panel.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await page.reload();
  await expect(pet).toBeVisible();
  await pet.click();
  await panel.getByRole('button', { name: '设置' }).click();
  await expect(page.getByLabel('薪资金额')).toHaveValue('4200');
  await expect(page.getByRole('combobox', { name: '上班 HH', exact: true })).toHaveValue('08');
  await expect(page.getByRole('combobox', { name: '角色', exact: true })).toHaveValue('girl');
});

test('cycles dialogue and pose interactions across consecutive clicks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '小周' }).click();
  const pet = page.getByRole('button', { name: '桌宠信息' });
  await pet.click();
  await expect(page.getByRole('status', { name: '桌宠对话' })).toContainText('嗨，我在这儿！');
  await pet.click();
  await expect(page.getByRole('status', { name: '桌宠对话' })).toContainText('给你打个气！');
});

test('speaks after inactivity without opening the dashboard', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-03T06:30:00Z') });
  await page.goto('/');
  await page.getByRole('button', { name: '小周' }).click();
  await page.mouse.move(5, 5);
  await page.clock.fastForward(29000);
  await expect(page.getByRole('status', { name: '桌宠对话' })).toContainText('今日估算 ￥0.00');
  await expect(page.getByRole('region', { name: '工资面板' })).toHaveCount(0);
  await page.clock.fastForward(5000);
  await expect(page.getByRole('status', { name: '桌宠对话' })).toBeHidden();
  await page.evaluate(() => localStorage.setItem('wagespark.prefs', JSON.stringify({ private: true })));
  await page.reload();
  await page.clock.fastForward(29000);
  await expect(page.getByRole('status', { name: '桌宠对话' })).toBeVisible();
  await expect(page.getByRole('status', { name: '桌宠对话' })).not.toContainText('￥');
});

test('keeps the dialogue and disables visual motion when requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: '跳过' }).click();
  await page.getByRole('button', { name: '桌宠信息' }).click();
  await expect(page.getByRole('status', { name: '桌宠对话' })).toBeVisible();
  await expect(page.getByRole('region', { name: '工资面板' })).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.pet-sparks')).toBeHidden();
});

test('imports a local image, keeps it after a rejected replacement and can restore the built-in pet', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '跳过' }).click();
  await page.getByRole('button', { name: '桌宠信息' }).click();
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByText('角色管理器', { exact: true }).click();
  const picker = page.getByLabel('PNG / WebP');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16; canvas.height = 16;
    const context = canvas.getContext('2d')!;
    context.fillRect(4, 4, 8, 8);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await picker.setInputFiles({
    name: 'original.png', mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64')
  });
  await page.getByRole('button', { name: '预览导入' }).click();
  await expect(page.getByText('original.png · Local import · Private')).toBeVisible();
  await picker.setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
  await page.getByRole('button', { name: '预览导入' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('original.png · Local import · Private')).toBeVisible();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.pet-button .custom-sprite')).toBeVisible();
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByText('角色管理器', { exact: true }).click();
  await page.getByRole('button', { name: '删除并恢复内置角色' }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.pet-button .custom-sprite')).toHaveCount(0);
});

test('saves a wish and leave, switches language and hides earnings', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-03T06:30:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: '跳过' }).click();
  await page.getByRole('button', { name: '桌宠信息' }).click();
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByLabel('薪资金额').fill('6000');
  await page.getByRole('combobox', { name: '时区' }).selectOption('Asia/Shanghai');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('￥0.00992 / 秒', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '愿望 / 日历' }).click();
  await page.getByRole('textbox', { name: '愿望', exact: true }).fill('Coffee');
  await page.getByLabel('目标金额').fill('25');
  await page.getByRole('button', { name: '添加愿望' }).click();
  await expect(page.getByRole('progressbar', { name: 'Coffee' })).toBeVisible();
  await expect(page.getByRole('button', { name: '删除 Coffee' })).toBeVisible();
  await expect(page.getByText('3.5 h')).toBeVisible();
  await expect(page.locator('.goal-countdown')).toContainText('预计天数 1 天');
  await expect(page.locator('.goal-countdown')).toContainText('倒计时 03:30:00');
  await page.screenshot({ path: 'artifacts/product-goals.png', animations: 'disabled' });
  await page.getByRole('button', { name: '2026-11-13' }).click();
  await expect(page.getByLabel('休假日期')).toHaveValue('2026-11-13');
  await page.getByRole('button', { name: '保存休假' }).click();
  await expect(page.getByText('2026-11-13 · 无薪假')).toBeVisible();
  await page.getByRole('button', { name: '设置' }).click();
  await page.getByLabel('隐藏金额').check();
  await page.getByRole('combobox', { name: '语言' }).selectOption('en');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Earnings dashboard' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '••••' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Coffee' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ja');
  await page.getByRole('combobox', { name: 'Theme' }).selectOption('frost');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('region', { name: '給与ダッシュボード' })).toBeVisible();
  await expect(page.locator('.stage')).toHaveAttribute('data-theme', 'frost');
});
