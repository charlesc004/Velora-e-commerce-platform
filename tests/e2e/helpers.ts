import { type Page } from '@playwright/test';

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('VeloraDemo2026!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/login');
}

export async function fillAddress(page: Page): Promise<void> {
  await page.getByLabel('Full name', { exact: true }).fill('Taylor Sample');
  await page.getByLabel('Street address', { exact: true }).fill('24 Fictional Lane');
  await page.getByLabel('City', { exact: true }).fill('Portland');
  await page.getByLabel('State / region', { exact: true }).fill('Oregon');
  await page.getByLabel('ZIP / postal code', { exact: true }).fill('97201');
  await page.getByLabel('Country', { exact: true }).selectOption('US');
}
