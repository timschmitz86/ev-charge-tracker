import { test, expect } from '@playwright/test'

test('homepage renders the main charging UI', async ({ page }) => {
  await page.route('**/api/charging*', async (route) => {
    const url = route.request().url()

    if (url.includes('/api/vehicle/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(12345)
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: [],
        activeSession: null,
        kwCost: 0.3
      })
    })
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: /EV Charge Tracker/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Start Charging/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /Start Charging/i })).toBeVisible()
})
