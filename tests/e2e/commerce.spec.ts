import { expect, test } from '@playwright/test';
import { fillAddress, signIn } from './helpers';

test('a guest browses, chooses a size, checks out, and reloads the persisted order', async ({
  page,
  browser,
}) => {
  await page.goto('/shop');
  await expect(page.locator('.product-card')).toHaveCount(12);
  await page
    .getByRole('link', { name: /^View / })
    .first()
    .click();
  await expect(page).toHaveURL(/\/product\//);
  await expect(page.locator('.product-detail')).toBeVisible();
  const productName = await page.getByRole('heading', { level: 1 }).innerText();
  const productPath = new URL(page.url()).pathname;
  await page
    .getByRole('button', { name: /^Size /, disabled: false })
    .first()
    .click();
  await page.getByRole('button', { name: /^Add to bag/ }).click();
  await expect(page.getByText('A good addition to your bag.', { exact: true })).toBeVisible();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: productName, exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Continue to checkout/ }).click();
  await page.getByLabel('Email address', { exact: true }).fill('guest.e2e@example.test');
  await fillAddress(page);
  await page.getByRole('button', { name: /Continue to delivery/ }).click();
  await page.getByRole('button', { name: /Review your order/ }).click();
  await expect(page.getByRole('radio', { name: /Demo payment/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Stripe/ })).toHaveCount(0);
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page.getByRole('heading', { name: 'Good things are on their way.' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Shopping bag, 0 items', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/orders\/[a-f\d]{24}\?token=/);
  const orderURL = new URL(page.url());
  const orderId = orderURL.pathname.split('/').at(-1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Good things are on their way.' })).toBeVisible();
  const persisted = await page.request.get(
    `/api/v1/orders/${orderId}?token=${orderURL.searchParams.get('token')}`,
  );
  expect(persisted.ok()).toBe(true);
  expect((await persisted.json()).data).toMatchObject({
    paymentStatus: 'paid',
    email: 'guest.e2e@example.test',
  });

  const outsider = await browser.newContext({ baseURL: orderURL.origin });
  try {
    expect((await outsider.request.get(`/api/v1/orders/${orderId}`)).status()).toBe(404);
  } finally {
    await outsider.close();
  }
  await page.goto(productPath);
  await page.getByRole('button', { name: /^Add to bag/ }).click();
  await expect(page.getByText('A good addition to your bag.', { exact: true })).toBeVisible();
  await page.goto(orderURL.pathname + orderURL.search);
  await expect(page.getByRole('heading', { name: 'Good things are on their way.' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Shopping bag, 1 items', exact: true }),
  ).toBeVisible();
});

test('an administrator creates a product and records an auditable stock adjustment', async ({
  page,
}) => {
  await signIn(page, 'admin@velora.local');
  await page.goto('/admin/products');
  await page.getByRole('button', { name: 'Add product', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const productName = `E2E Linen Overshirt ${Date.now()}`;
  await dialog.getByLabel('Product name', { exact: true }).fill(productName);
  await dialog.getByLabel('SKU', { exact: true }).fill(`E2E-${Date.now()}`);
  await dialog.getByLabel('Status', { exact: true }).selectOption('published');
  await dialog.getByLabel('Category', { exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel('Collection', { exact: true }).selectOption({ index: 1 });
  await dialog.getByLabel('Price (USD)', { exact: true }).fill('129');
  await dialog
    .getByLabel('Description', { exact: true })
    .fill(
      'A fictional linen overshirt created by the browser test to verify product administration.',
    );
  await dialog.getByLabel('Units in stock', { exact: true }).fill('4');
  await dialog.getByRole('button', { name: 'Create product', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel('Search products', { exact: true }).fill(productName);
  await expect(page.getByRole('row', { name: new RegExp(productName) })).toContainText(
    '4 in stock',
  );
  await page.goto('/admin/inventory');
  await page.getByLabel('Search inventory', { exact: true }).fill(productName);
  const inventoryRow = page.getByRole('row', { name: new RegExp(productName) });
  await inventoryRow.getByRole('button', { name: 'Adjust stock', exact: true }).click();
  await dialog
    .getByLabel('Unit adjustment (positive to add, negative to remove)', { exact: true })
    .fill('3');
  const reason = `E2E shipment ${Date.now()}`;
  await dialog.getByLabel('Reason for adjustment', { exact: true }).fill(reason);
  await dialog.getByRole('button', { name: 'Record adjustment', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(inventoryRow.getByText('7', { exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(reason) })).toContainText('+3');
  await page.setViewportSize({ width: 390, height: 844 });
  const menuButton = page.getByRole('button', { name: 'Open navigation', exact: true });
  await menuButton.click();
  await expect(page.getByRole('dialog', { name: 'VELORA workspace', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(menuButton).toBeFocused();
  await menuButton.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get('/api/v1/admin/products')).status()).toBe(401);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
});

test('mobile catalog filters remain shareable and reset without restoring an old search', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'A quieter kind of statement.' })).toBeVisible();
  await expect(page.locator('.hero-content')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/velora-mobile.png' });
  await page.goto('/shop?q=cashmere&gender=women');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Filter by color', { exact: true }).selectOption('Oatmeal');
  await expect(page).toHaveURL(/color=Oatmeal/);
  await dialog.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await dialog.getByRole('button', { name: /^Show .* pieces$/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Search products', exact: true })).toHaveValue('');
  await expect(page.locator('.product-card')).toHaveCount(12);
  await expect(page).toHaveURL(/\/shop$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('guest and customer requests cannot perform administration or read another account order', async ({
  page,
  browser,
}) => {
  expect((await page.request.get('/api/v1/admin/dashboard')).status()).toBe(401);
  const origin = new URL(test.info().project.use.baseURL as string).origin;
  expect(
    (await page.request.post('/api/v1/admin/products', { data: {}, headers: { origin } })).status(),
  ).toBe(401);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
  await signIn(page, 'customer@velora.local');
  expect((await page.request.get('/api/v1/admin/products')).status()).toBe(403);
  const ownOrders = await page.request.get('/api/v1/orders');
  expect(ownOrders.ok()).toBe(true);
  const orders = (await ownOrders.json()).data.items as { id: string }[];
  expect(orders.length).toBeGreaterThan(0);
  const outsider = await browser.newContext({ baseURL: origin });
  try {
    const registration = await outsider.request.post('/api/v1/auth/register', {
      data: {
        name: 'Second Test Customer',
        email: `privacy.${Date.now()}@example.test`,
        password: 'VeloraDemo2026!',
      },
      headers: { origin },
    });
    expect(registration.status()).toBe(201);
    expect((await outsider.request.get(`/api/v1/orders/${orders[0].id}`)).status()).toBe(404);
    expect((await outsider.request.get('/api/v1/admin/orders')).status()).toBe(403);
  } finally {
    await outsider.close();
  }
  await page.goto('/account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  const anonymous = await page.request.get('/api/v1/auth/me');
  expect((await anonymous.json()).data).toBeNull();
  await page.goto('/account');
  await expect(page).toHaveURL(/\/login/);
});
