import { test, expect } from '@playwright/test'

const buildChargingApiMock = async (page, initialState = {}) => {
  const state = {
    entries: initialState.entries ?? [],
    activeSession: initialState.activeSession ?? null,
    kwCost: initialState.kwCost ?? 0.3
  }

  await page.route('**/api/charging', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        entries: state.entries,
        activeSession: state.activeSession,
        kwCost: state.kwCost
      })
    })
  })

  await page.route('**/api/charging/start', async (route) => {
    const body = route.request().postDataJSON()
    state.activeSession = {
      id: 'active-session-1',
      createdAt: '2024-01-01T10:00:00.000Z',
      meterStart: body.meterStart,
      kmStand: body.kmStand
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'active-session-1',
        clientSessionId: 'client-1',
        createdAt: '2024-01-01T10:00:00.000Z',
        kmStand: body.kmStand,
        meterStart: body.meterStart
      })
    })
  })

  await page.route('**/api/charging/finish', async (route) => {
    const body = route.request().postDataJSON()
    state.entries = [
      {
        id: 'entry-1',
        createdAt: '2024-01-01T10:30:00.000Z',
        kmStand: 45250,
        meterStart: 1234.56,
        meterEnd: body.meterEnd,
        chargedKwh: body.meterEnd - 1234.56,
        exported: false,
        kwCostAtTime: state.kwCost
      },
      ...state.entries
    ]
    state.activeSession = null

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'entry-1',
        meterEnd: body.meterEnd,
        chargedKwh: body.meterEnd - 1234.56
      })
    })
  })

  await page.route('**/api/charging/cost', async (route) => {
    const body = route.request().postDataJSON()
    state.kwCost = body.kwCost
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ kwCost: state.kwCost })
    })
  })

  await page.route('**/api/vehicle*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(12345)
    })
  })
}

test('allows starting a charging session through the main form', async ({ page }) => {
  await buildChargingApiMock(page)

  const initialLoad = page.waitForResponse((response) => response.url().includes('/api/charging') && response.request().method() === 'GET')
  await page.goto('/')
  await initialLoad

  await page.getByLabel(/Car Mileage/i).fill('45230')
  await page.getByLabel(/Electricity Meter Start/i).fill('1234.56')
  const startResponse = page.waitForResponse((response) => response.url().includes('/api/charging/start'))
  await page.getByRole('button', { name: /^Start Charging$/i }).click()
  await startResponse

  await expect(page.getByText(/Charging in progress/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Finish Charging/i })).toBeVisible()
})

test('allows finishing a charging session from the active-session form', async ({ page }) => {
  await buildChargingApiMock(page, {
    activeSession: {
      id: 'active-session-1',
      createdAt: '2024-01-01T10:00:00.000Z',
      meterStart: 1234.56,
      kmStand: 45230
    }
  })

  const initialLoad = page.waitForResponse((response) => response.url().includes('/api/charging') && response.request().method() === 'GET')
  await page.goto('/')
  await initialLoad

  await expect(page.getByRole('heading', { name: /Finish Charging/i })).toBeVisible()
  await page.getByLabel(/Electricity Meter End/i).fill('1250.00')
  const finishResponse = page.waitForResponse((response) => response.url().includes('/api/charging/finish'))
  await page.getByRole('button', { name: /^Finish Charging$/i }).click()
  await finishResponse

  await expect(page.getByRole('heading', { name: /Start Charging/i })).toBeVisible()
})

test('expands charging history and shows saved sessions', async ({ page }) => {
  await buildChargingApiMock(page, {
    entries: [{
      id: 'entry-1',
      createdAt: '2024-01-01T10:30:00.000Z',
      kmStand: 45250,
      meterStart: 1234.56,
      meterEnd: 1250.00,
      chargedKwh: 15.44,
      exported: false,
      kwCostAtTime: 0.3
    }]
  })

  await page.goto('/')

  await page.getByRole('button', { name: /Charging History/i }).click()

  await expect(page.getByText(/45250 km/i)).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/View Details/i)).toBeVisible()
})

test('updates the cost and switches the interface language from configuration', async ({ page }) => {
  await buildChargingApiMock(page)
  await page.addInitScript(() => {
    window.localStorage.setItem('configExpanded', 'true')
    window.localStorage.setItem('historyExpanded', 'false')
  })

  const initialLoad = page.waitForResponse((response) => response.url().includes('/api/charging') && response.request().method() === 'GET')
  await page.goto('/')
  await initialLoad

  await expect(page.getByText(/Current cost:/i)).toBeVisible()
  await page.getByRole('button', { name: /^Edit$/i }).click()
  await page.getByLabel(/Cost \(€\/kWh\):/i).fill('0.45678')
  const costResponse = page.waitForResponse((response) => response.url().includes('/api/charging/cost'))
  await page.getByRole('button', { name: /^Save$/i }).click()
  await costResponse

  await expect(page.getByText(/0\.45678 €\/kWh/)).toBeVisible()

  await page.locator('.lang-toggle').click()
  await expect(page.locator('.config-row')).toContainText(/DE|German/i)
})

test('shows an API error when starting charging fails', async ({ page }) => {
  await buildChargingApiMock(page)

  await page.route('**/api/charging/start', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Request failed' })
    })
  })

  await page.goto('/')

  await page.getByLabel(/Car Mileage/i).fill('45230')
  await page.getByLabel(/Electricity Meter Start/i).fill('1234.56')
  await page.getByRole('button', { name: /^Start Charging$/i }).click()

  await expect(page.getByText(/Request failed/i)).toBeVisible()
})
