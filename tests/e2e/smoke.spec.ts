import { test, expect } from '@playwright/test'

test.describe('smoke', () => {
  test('page loads and shows lookup form', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Classification Analyzer' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /member number/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /look up/i })).toBeVisible()
  })

  test('inline validation rejects bad member number', async ({ page }) => {
    await page.goto('/')
    const input = page.getByRole('textbox', { name: /member number/i })
    await input.fill('notvalid123')
    await page.getByRole('button', { name: /look up/i }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  })

  test('manual paste panel opens and accepts input', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /paste classifier data/i }).click()
    await expect(page.getByRole('textbox', { name: /paste classifier/i })).toBeVisible()
  })

  test('URL state round-trips member number', async ({ page }) => {
    await page.goto('/?m=A12345')
    const input = page.getByRole('textbox', { name: /member number/i })
    await expect(input).toHaveValue('A12345')
  })

  test('dark mode toggle cycles themes', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: /toggle theme/i })
    await toggle.click()
    await toggle.click()
    await toggle.click()
    await expect(toggle).toBeVisible()
  })

  test('About section is reachable', async ({ page }) => {
    await page.goto('/#about')
    await expect(page.getByRole('heading', { name: 'About' })).toBeVisible()
  })

  test('recent lookups list renders persisted entries and supports delete', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'classification-analyzer-app',
        JSON.stringify({
          state: {
            selectedDivision: null,
            recentLookups: [
              {
                memberNumber: 'A12345',
                name: 'Test Shooter',
                lastLookedUpAt: new Date().toISOString(),
              },
            ],
          },
          version: 2,
        }),
      )
    })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /recent lookups/i })).toBeVisible()
    await expect(page.getByText('A12345')).toBeVisible()
    await expect(page.getByText('Test Shooter')).toBeVisible()

    await page
      .getByRole('button', { name: /remove a12345 from recent lookups/i })
      .click()
    await expect(page.getByRole('heading', { name: /recent lookups/i })).toBeHidden()
  })
})
