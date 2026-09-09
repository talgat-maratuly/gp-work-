import { test, expect, type Page } from 'playwright/test'

// Only camera/GPS hardware is simulated. Setup and every business action use
// the real NestJS API and PostgreSQL. No fixture responses replace the backend.
// Distinct test clients use separate proxy IPs, as in the server E2E suite;
// production throttling remains enabled and unchanged.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGOUaXJkoCVgoqnpoxaMWjBqwagFoxaMWjBqwagFoxaMWjBqARUBAB7RAR8ze0hjAAAAAElFTkSuQmCC', 'base64')
const api = 'http://localhost:3002/api'
const adminName = process.env.ADMIN_USERNAME || 'e2e-admin'
const adminPassword = process.env.ADMIN_PASSWORD || 'e2e-admin-password'

async function login(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

async function captureEvidence(page: Page) {
  await page.getByRole('button', { name: 'Включить фронтальную камеру', exact: true }).click()
  for (let i = 1; i <= 3; i++) {
    await page.getByRole('button', { name: `Снять кадр ${i} из 3`, exact: true }).click()
  }
  await page.locator('input[type="file"]').setInputFiles({ name: 'work.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('button', { name: 'Переснять', exact: true })).toBeVisible()
}

test('worker day: GPS, real uploads, lost response retry, review and protected photos', async ({ page, context, browser, request }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  const authResponse = await request.post(`${api}/auth/login`, { data: { username: adminName, password: adminPassword } })
  expect(authResponse.ok()).toBeTruthy()
  const admin = await authResponse.json()
  const headers = { Authorization: `Bearer ${admin.accessToken}` }
  const create = async (path: string, data: unknown) => {
    const result = await request.post(`${api}${path}`, { headers, data })
    expect(result.ok(), await result.text()).toBeTruthy()
    return result.json()
  }
  const worker = await create('/users', { fullName: `Browser Worker ${suffix}`, username: `browser-${suffix}`, password: 'browser-worker-password', role: 'WORKER' })
  const object = await create('/objects', { name: `Browser object ${suffix}` })
  const section = await create('/sections', { objectId: object.id, name: `Browser section ${suffix}` })
  const configured = await request.patch(`${api}/sections/${section.id}`, { headers, data: { latitude: 51.2301, longitude: 51.3701, radiusMeters: 150 } })
  expect(configured.ok()).toBeTruthy()
  const workType = await create('/work-types', { name: `Browser task type ${suffix}` })
  await create('/tasks', { sectionId: section.id, workTypeId: workType.id, assigneeUserId: worker.id, dueDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Oral', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), description: `Уборка ${suffix}` })

  await test.step('login, camera capture and reject imprecise GPS before uploading', async () => {
    await login(page, worker.username, 'browser-worker-password')
    await page.goto(`/field/scan/${section.code}`)
    await expect(page.getByText('Автоматическое распознавание лица не выполняется.', { exact: false })).toBeVisible()
    await captureEvidence(page)
    await context.setGeolocation({ latitude: 51.2301, longitude: 51.3701, accuracy: 500 })
    await page.getByRole('button', { name: 'Начать рабочий день', exact: true }).click()
    await expect(page.getByText('Погрешность GPS больше 50 м.', { exact: false })).toBeVisible()
    await context.setGeolocation({ latitude: 51.2301, longitude: 51.3701, accuracy: 5 })
  })

  await test.step('server commits the shift, lost response is retried with exactly the same evidence', async () => {
    const payloads: unknown[] = []
    await page.route('**/api/field/work-days/start', async (route) => {
      payloads.push(route.request().postDataJSON())
      if (payloads.length === 1) {
        const result = await route.fetch()
        expect(result.status()).toBe(201)
        await route.abort('failed')
      } else await route.continue()
    })
    await page.getByRole('button', { name: 'Начать рабочий день', exact: true }).click()
    await page.getByRole('button', { name: 'Повторить отправку', exact: true }).click()
    await expect(page.getByText('Рабочий день открыт по серверному времени', { exact: true })).toBeVisible()
    expect(payloads).toHaveLength(2)
    expect(payloads[1]).toEqual(payloads[0])
    await page.unroute('**/api/field/work-days/start')
    // Evidence controls must reset after a successful start (a previous defect).
    await expect(page.getByRole('button', { name: 'Включить фронтальную камеру', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Переснять', exact: true })).toHaveCount(0)
  })

  await test.step('close a partial shift with fresh photos and an explicit reason', async () => {
    await captureEvidence(page)
    await page.getByRole('slider').focus()
    await page.getByRole('slider').press('End')
    await page.getByRole('slider').press('ArrowLeft')
    await page.getByPlaceholder('Фактический объём и единица').fill('99 м²')
    await page.getByPlaceholder('Что выполнено', { exact: true }).fill('Уборка территории')
    await page.getByRole('button', { name: 'Завершить рабочий день', exact: true }).click()
    await expect(page.getByText('укажите причину незавершения', { exact: false })).toBeVisible()
    await page.getByPlaceholder('Обязательная причина незавершения').fill('Остался край участка')
    await page.getByRole('button', { name: 'Завершить рабочий день', exact: true }).click()
    await expect(page.getByText('Рабочий день завершён', { exact: true })).toBeVisible()
  })

  const managerContext = await browser.newContext({ extraHTTPHeaders: { 'X-Forwarded-For': '10.30.0.20' }, baseURL: 'http://localhost:5173', viewport: { width: 1440, height: 1000 } })
  const manager = await managerContext.newPage()
  try {
    await test.step('manager sees real protected images and returns work with a reason', async () => {
      await login(manager, adminName, adminPassword)
      await manager.goto('/admin/work-days')
      const article = manager.locator('article').filter({ hasText: worker.fullName })
      await expect(article).toHaveCount(1)
      await expect(article.getByText('99%', { exact: true }).first()).toBeVisible()
      await expect.poll(() => article.locator('img').evaluateAll((images) => images.length >= 8 && images.every((img) => (img as HTMLImageElement).naturalWidth > 0))).toBeTruthy()
      const photo = await article.locator('img').first().getAttribute('src')
      expect(photo).toBeTruthy()
      const anonymous = await browser.newContext()
      try { expect((await anonymous.request.get(`http://localhost:5173${photo}`)).status()).toBe(401) } finally { await anonymous.close() }
      await article.getByPlaceholder('Комментарий; обязателен при возврате').fill('Доделать край участка')
      await article.getByRole('button', { name: 'Вернуть', exact: true }).click()
      await expect(article.getByText('RETURNED', { exact: true })).toBeVisible()
    })

    await test.step('worker corrects and manager accepts; logout removes photo access', async () => {
      await page.reload()
      await expect(page.getByText('Смена возвращена на исправление', { exact: true })).toBeVisible()
      await captureEvidence(page)
      await page.getByRole('slider').focus()
      await page.getByRole('slider').press('End')
      await page.getByPlaceholder('Фактический объём и единица').fill('100 м²')
      await page.getByPlaceholder('Что выполнено', { exact: true }).fill('Край участка очищен')
      await page.getByRole('button', { name: 'Исправить и повторно отправить', exact: true }).click()
      await expect(page.getByText('Рабочий день завершён', { exact: true })).toBeVisible()
      await manager.reload()
      const article = manager.locator('article').filter({ hasText: worker.fullName })
      await article.getByRole('button', { name: 'Подтвердить', exact: true }).click()
      await expect(article.getByText('REVIEWED', { exact: true })).toBeVisible()
      await expect(article.getByText('100%', { exact: true }).first()).toBeVisible()
      const photo = await article.locator('img').first().getAttribute('src')
      await manager.screenshot({ path: testInfo.outputPath('reviewed-work-day.png'), fullPage: true })
      await manager.evaluate(async () => {
        const cache = await caches.open('gp-work-photos')
        await cache.put('/uploads/photos/old-cache.jpg', new Response('old private photo'))
      })
      await Promise.all([
        manager.waitForResponse((response) => response.url().endsWith('/api/auth/logout') && response.status() === 201),
        manager.getByRole('button', { name: 'Выйти', exact: true }).click(),
      ])
      await expect(manager).toHaveURL(/\/login$/)
      await expect.poll(() => manager.evaluate(async () => (await caches.keys()).includes('gp-work-photos'))).toBeFalsy()
      expect((await managerContext.request.get(`http://localhost:5173${photo}`)).status()).toBe(401)
    })
  } finally { await managerContext.close() }
})
