import { expect, test } from '@playwright/test';
import { fillAddress, signIn } from './helpers';

test('registration merges a guest bag, and wishlist, profile and address changes persist', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/product/the-cashmere-crew');
  await page.getByRole('button', { name: /^Add to bag/ }).click();
  await expect(page.getByText('A good addition to your bag.', { exact: true })).toBeVisible();
  const email = `release.${Date.now()}@example.test`;
  await page.goto('/register');
  await page.getByLabel('Full name', { exact: true }).fill('Release Customer');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('VeloraDemo2026!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole('heading', { name: 'The details that make you, you.', exact: true }),
  ).toBeVisible();
  const bag = await page.request.get('/api/v1/cart');
  expect((await bag.json()).data.items).toHaveLength(1);
  await page.getByLabel('Full name', { exact: true }).fill('Release Customer Updated');
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(
    'Release Customer Updated',
  );
  await page.getByRole('button', { name: 'Save your details', exact: true }).click();
  await expect(page.getByText('Your details are up to date.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(
    'Release Customer Updated',
  );
  await page.context().clearCookies({ name: 'velora_access' });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'The details that make you, you.', exact: true }),
  ).toBeVisible();
  await page.goto('/product/the-cashmere-crew');
  await page.getByRole('button', { name: 'Save to wishlist', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Saved to your wishlist', exact: true }),
  ).toBeVisible();
  await page.goto('/wishlist');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.goto('/account/addresses');
  await page.getByRole('button', { name: 'Add address', exact: true }).click();
  await fillAddress(page);
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.address-card')).toContainText('24 Fictional Lane');
  await page.reload();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Street address', { exact: true }).fill('25 Fictional Lane');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.locator('.address-card')).toContainText('25 Fictional Lane');
  await page.goto('/checkout');
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(email);
  await expect(page.getByLabel('Street address', { exact: true })).toHaveValue('25 Fictional Lane');
  await page.goto('/account/addresses');
  await page.getByRole('button', { name: 'Remove address 1', exact: true }).click();
  await expect(page.locator('.address-card')).toHaveCount(0);
});

test('an account checkout applies a coupon and express shipping using server totals', async ({
  page,
}) => {
  await signIn(page, 'customer@velora.local');
  await page.goto('/product/the-cashmere-crew');
  await page.getByRole('button', { name: /^Add to bag/ }).click();
  await expect(page.getByText('A good addition to your bag.', { exact: true })).toBeVisible();
  await page.goto('/checkout');
  await expect(page.getByLabel('Email address', { exact: true })).toHaveValue(
    'customer@velora.local',
  );
  await page.getByPlaceholder('Discount code', { exact: true }).fill('NOT-A-VALID-CODE');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('unavailable or has expired');
  await page.getByRole('button', { name: 'Remove NOT-A-VALID-CODE', exact: true }).click();
  await page.getByPlaceholder('Discount code', { exact: true }).fill('WELCOME10');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('.discount-line')).toContainText('WELCOME10');
  await page.getByRole('button', { name: /Continue to delivery/ }).click();
  await page.getByRole('radio', { name: /Express delivery/ }).check();
  await page.getByRole('button', { name: /Review your order/ }).click();
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page.getByRole('heading', { name: 'Good things are on their way.' })).toBeVisible();
  const id = new URL(page.url()).pathname.split('/').at(-1);
  const order = (await (await page.request.get(`/api/v1/orders/${id}`)).json()).data;
  expect(order).toMatchObject({ paymentStatus: 'paid', shippingMethod: 'express' });
  expect(order.userId).toBeTruthy();
  expect(order.totals.shipping).toBe(1800);
  expect(order.totals.discount).toBe(Math.round(order.totals.subtotal * 0.1));
  expect(order.totals.total).toBe(
    order.totals.subtotal - order.totals.discount + order.totals.tax + 1800,
  );
  await page.goto('/account/orders');
  await expect(page.getByRole('link', { name: new RegExp(order.number) })).toBeVisible();
});

test('checkout handles unavailable payments and selects Stripe when it is the only configured method', async ({
  page,
}) => {
  let paymentMethods: string[] = [];
  await page.route('**/api/v1/checkout/options', (route) =>
    route.fulfill({
      json: {
        data: {
          shipping: { standard: 800, express: 1800, freeThreshold: 15000 },
          taxRate: 0.08,
          paymentMethods,
        },
      },
    }),
  );
  await page.goto('/product/the-cashmere-crew');
  await page.getByRole('button', { name: /^Add to bag/ }).click();
  await expect(page.getByText('A good addition to your bag.', { exact: true })).toBeVisible();
  const review = async () => {
    await page.goto('/checkout');
    await page.getByLabel('Email address', { exact: true }).fill('availability@example.test');
    await fillAddress(page);
    await page.getByRole('button', { name: /Continue to delivery/ }).click();
    await page.getByRole('button', { name: /Review your order/ }).click();
  };
  await review();
  await expect(page.getByRole('alert')).toContainText('Payments are temporarily unavailable');
  await expect(page.getByRole('button', { name: /^Place order/ })).toBeDisabled();
  paymentMethods = ['stripe'];
  await review();
  await expect(page.getByRole('radio', { name: /Stripe test checkout/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Demo payment/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Continue to Stripe', exact: true })).toBeEnabled();
});

test('an administrator manages taxonomy and discounts and searches variant SKUs', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page, 'admin@velora.local');
  const name = `Release category ${Date.now()}`;
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Add category', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog
    .getByLabel('Description', { exact: true })
    .fill('Fictional category for release verification.');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialog.getByLabel('Name', { exact: true }).fill(`${name} Updated`);
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: `Delete ${name} Updated`, exact: true }).click();
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: `${name} Updated`, exact: true })).toHaveCount(0);
  await page.goto('/admin/discounts');
  await page.getByRole('button', { name: 'Create discount', exact: true }).click();
  const code = `QA${Date.now()}`;
  await dialog.getByLabel('Discount code', { exact: true }).fill(code);
  await dialog.getByLabel('Percentage off', { exact: true }).fill('15');
  await dialog.getByRole('button', { name: 'Save discount', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(code) });
  await expect(row).toContainText('15% off');
  await row.getByRole('button', { name: 'Deactivate', exact: true }).click();
  await expect(row).toContainText('Inactive');
  await row.getByRole('button', { name: 'Activate', exact: true }).click();
  await expect(row).toContainText('Active');
  await page.goto('/admin/inventory');
  await page.getByLabel('Search inventory', { exact: true }).fill('VL-1-0-0');
  await expect(page.getByRole('row', { name: /VL-1-0-0/ })).toBeVisible();
});

test('public pages, product assets and admin sections render without crashes or horizontal overflow', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  for (const path of [
    '/',
    '/shop',
    '/product/the-cashmere-crew',
    '/cart',
    '/checkout',
    '/wishlist',
    '/login',
    '/register',
    ...[
      'our-story',
      'shipping',
      'returns',
      'care',
      'materials',
      'contact',
      'privacy',
      'terms',
      'constructor',
    ].map((slug) => `/information/${slug}`),
    '/does-not-exist',
  ]) {
    await page.goto(path);
    await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
    await expect(page.getByText('We couldn’t load this just yet.', { exact: true })).toHaveCount(0);
  }
  await page.goto('/product/the-cashmere-crew');
  await expect(page.getByRole('heading', { name: 'The Cashmere Crew', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'My account', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /^Considered clothing\./,
  );
  const products = (await (await page.request.get('/api/v1/products?limit=100')).json()).data
    .items as { images: string[] }[];
  for (const image of new Set(products.flatMap((product) => product.images))) {
    const response = await page.request.get(image);
    expect(response.status(), image).toBe(200);
    expect(response.headers()['content-type'], image).toMatch(/^image\//);
  }
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/shop', '/product/the-cashmere-crew', '/cart', '/login']) {
      await page.goto(path);
      await expect(page.getByRole('main').getByRole('heading').first()).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${path} at ${width}px`,
      ).toBe(true);
    }
  }
  await signIn(page, 'admin@velora.local');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const section of [
      '',
      '/products',
      '/inventory',
      '/orders',
      '/customers',
      '/discounts',
      '/categories',
      '/collections',
      '/analytics',
      '/settings',
    ]) {
      await page.goto(`/admin${section}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('We couldn’t load this just yet.', { exact: true })).toHaveCount(
        0,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `admin${section} at ${width}px`,
      ).toBe(true);
    }
  }
  expect(failures).toEqual([]);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: 'test-results/release-admin-desktop.png', fullPage: true });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/release-storefront-desktop.png', fullPage: true });
});
