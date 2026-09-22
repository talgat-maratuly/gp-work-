import { test, expect } from 'playwright/test'

const api = 'http://localhost:3002/api'
const password = 'attendance-browser-password'

for (const [role, ip] of [['WORKER', '10.30.0.48'], ['ACCOUNTANT', '10.30.0.49']]) {
  test.describe(`${role} attendance`, () => {
    test.use({ extraHTTPHeaders: { 'X-Forwarded-For': ip } })
    test('starts with GPS, survives reload, finishes and appears once in manager timesheet', async ({ page, request, browser }, info) => {
      const username = `clock-${role.toLowerCase()}-${Date.now()}-${info.project.name}`
      const adminLogin = await request.post(`${api}/auth/login`, { data: { username: process.env.ADMIN_USERNAME || 'e2e-admin', password: process.env.ADMIN_PASSWORD || 'e2e-admin-password' } })
      expect(adminLogin.ok()).toBeTruthy()
      const adminToken = (await adminLogin.json()).accessToken
      expect((await request.post(`${api}/users`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { username, password, fullName: username, role } })).ok()).toBeTruthy()
      const errors: string[] = []
      const starts: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', req => { if (req.url().endsWith('/attendance/me/start')) starts.push(req.method()) })
      await page.addInitScript(() => {
        const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation)
        navigator.geolocation.getCurrentPosition = (success, failure, options) => {
          if (sessionStorage.getItem('clock-deny-gps') === '1') {
            failure?.({ code: 1, message: 'Denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
          } else original(success, failure, options)
        }
      })
      await page.goto('/my-work-day')
      await page.getByLabel('Логин', { exact: true }).fill(username)
      await page.getByLabel('Пароль', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Войти', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Мой рабочий день', exact: true })).toBeVisible()
      const panel = page.getByRole('region', { name: 'Отметка рабочего дня' })
      const start = panel.getByRole('button', { name: 'Начать рабочий день', exact: true })
      await expect(start).toBeEnabled()
      await page.evaluate(() => sessionStorage.setItem('clock-deny-gps', '1'))
      await start.click()
      await expect(panel.getByRole('alert')).toContainText('Не удалось получить геолокацию')
      expect(starts).toHaveLength(0)
      await page.evaluate(() => sessionStorage.removeItem('clock-deny-gps'))
      await page.route('**/api/attendance/me/start', route => route.abort('failed'))
      await start.click()
      await expect(panel.getByRole('alert')).toContainText('Не удалось связаться с сервером')
      await expect(start).toBeEnabled()
      await page.unroute('**/api/attendance/me/start')
      await start.click()
      await expect(panel.getByRole('button', { name: 'Завершить рабочий день', exact: true })).toBeEnabled()
      await expect(panel.getByRole('link', { name: /Место начала/ })).toHaveAttribute('href', /51\.2301/)
      const token = await page.evaluate(() => localStorage.getItem('gp-work_token'))
      const headers = { Authorization: `Bearer ${token}` }
      const active = await (await request.get(`${api}/attendance/me`, { headers })).json()
      expect(active.current).toMatchObject({ status: 'ON_DUTY', checkInAccuracy: 5 })
      await page.reload()
      await expect(panel.getByRole('button', { name: 'Завершить рабочий день', exact: true })).toBeEnabled()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`clock-${role.toLowerCase()}.png`), fullPage: true })
      await panel.getByRole('button', { name: 'Завершить рабочий день', exact: true }).click()
      await expect(panel.getByRole('status')).toContainText('Время сохранено в табеле')
      await expect(panel.getByText('Рабочий день завершён', { exact: true })).toBeVisible()
      const completed = await (await request.get(`${api}/attendance/me`, { headers })).json()
      expect(completed.recent).toHaveLength(1)
      expect(completed.current).toMatchObject({ id: active.current.id, status: 'COMPLETED', checkOutAccuracy: 5 })
      expect(typeof completed.current.workedHours).toBe('number')

      const manager = await browser.newContext({ baseURL: 'http://localhost:5173', viewport: info.project.use.viewport, extraHTTPHeaders: { 'X-Forwarded-For': ip } })
      try {
        await manager.addInitScript(token => localStorage.setItem('gp-work_token', token), adminToken)
        const report = await manager.newPage()
        await report.goto('/admin/attendance')
        await report.getByLabel('ФИО', { exact: true }).fill(username)
        const row = report.getByRole('row').filter({ has: report.getByRole('cell', { name: username, exact: true }) })
        await expect(row).toHaveCount(1)
        await expect(row).toContainText('Завершено')
        const summary = report.getByRole('region', { name: 'Итоги табеля' })
        await expect(summary.getByText('Сотрудников с отметкой', { exact: true }).locator('..')).toHaveText('1Сотрудников с отметкой')
        await expect(summary.getByText('Завершённых дней', { exact: true }).locator('..')).toHaveText('1Завершённых дней')
        await expect(summary.getByText('Открытых дней', { exact: true }).locator('..')).toHaveText('0Открытых дней')
        await expect(row.getByRole('link', { name: /Карта/ })).toHaveCount(2)
        expect(await report.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        await report.screenshot({ path: info.outputPath(`timesheet-${role.toLowerCase()}.png`), fullPage: true })
        await report.route('**/api/attendance?*', route => route.abort('failed'))
        await report.getByRole('button', { name: 'Обновить', exact: true }).click()
        await expect(report.getByRole('alert')).toBeVisible()
        await expect(summary).toHaveCount(0)
        await expect(row).toHaveCount(0)
      } finally { await manager.close() }
      expect(errors).toEqual([])
    })
  })
}

test('does not send a delayed GPS mark under a different account', async ({ page, request }, info) => {
  const ip = info.project.name === 'mobile-chromium' ? '10.30.0.51' : '10.30.0.50'
  const client = { 'X-Forwarded-For': ip }
  const login = async (username: string, pass = password) => {
    const result = await request.post(`${api}/auth/login`, { headers: client, data: { username, password: pass } })
    expect(result.ok()).toBeTruthy()
    return (await result.json()).accessToken
  }
  const admin = await login(process.env.ADMIN_USERNAME || 'e2e-admin', process.env.ADMIN_PASSWORD || 'e2e-admin-password')
  const accounts = []
  for (const side of ['a', 'b']) {
    const username = `clock-switch-${side}-${Date.now()}-${info.project.name}`
    expect((await request.post(`${api}/users`, { headers: { ...client, Authorization: `Bearer ${admin}` }, data: { username, password, fullName: username, role: 'WORKER' } })).ok()).toBeTruthy()
    accounts.push({ username, token: await login(username) })
  }
  await page.goto('/login')
  await page.evaluate(token => localStorage.setItem('gp-work_token', token), accounts[0].token)
  await page.goto('/my-work-day')
  await expect(page.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeEnabled()
  const starts: string[] = []
  page.on('request', req => { if (req.url().endsWith('/attendance/me/start')) starts.push(req.method()) })
  await page.evaluate(() => {
    navigator.geolocation.getCurrentPosition = success => { (window as any).finishClockGps = success }
  })
  await page.getByRole('button', { name: 'Начать рабочий день', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Определяем местоположение и сохраняем…', exact: true })).toBeDisabled()
  await page.evaluate(token => {
    localStorage.setItem('gp-work_token', token)
    window.dispatchEvent(new StorageEvent('storage', { key: 'gp-work_token', newValue: token }))
  }, accounts[1].token)
  await expect(page.getByLabel('Текущий аккаунт')).toContainText(accounts[1].username)
  await page.evaluate(() => { (window as any).finishClockGps({ coords: { latitude: 51.2301, longitude: 51.3701, accuracy: 5 } }) })
  await expect(page.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeEnabled()
  expect(starts).toHaveLength(0)
  for (const account of accounts) {
    const result = await request.get(`${api}/attendance/me`, { headers: { ...client, Authorization: `Bearer ${account.token}` } })
    expect((await result.json()).current).toBeNull()
  }
  await page.route('**/api/attendance/me', route => route.abort('failed'))
  await page.reload()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Начать рабочий день', exact: true })).toHaveCount(0)
  await page.unroute('**/api/attendance/me')
  await page.getByRole('button', { name: 'Обновить состояние', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeEnabled()
})
