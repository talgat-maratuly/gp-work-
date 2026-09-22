import { test, expect } from 'playwright/test'

test.use({ actionTimeout: 15_000 })

test('QR opens publicly without staff data; login returns to section and admin has no director cabinet', async ({ page, context, request }, info) => {
  const api = 'http://localhost:3002/api'
  const ip = `10.71.${info.project.name.startsWith('mobile') ? 2 : 1}.1`
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
  const username = process.env.ADMIN_USERNAME || 'e2e-admin', password = process.env.ADMIN_PASSWORD || 'e2e-admin-password'
  const auth = await request.post(`${api}/auth/login`, { headers: { 'X-Forwarded-For': ip }, data: { username, password } })
  expect(auth.ok()).toBeTruthy()
  const headers = { Authorization: `Bearer ${(await auth.json()).accessToken}`, 'X-Forwarded-For': ip }
  const create = async (path: string, data: unknown) => { const r = await request.post(api + path, { headers, data }); expect(r.ok(), await r.text()).toBeTruthy(); return r.json() }
  const object = await create('/objects', { name: `Public ${Date.now()}-${info.project.name}` })
  const section = await create('/sections', { objectId: object.id, name: `Открытый участок ${object.id}`, latitude: 51.2301, longitude: 51.3701 })
  const privateCalls: string[] = [], errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  const onRequest = (r: { url: () => string; method: () => string }) => { if (/\/api\/(?:users|tasks|field|form-settings|uploads)(?:\/|\?|$)/.test(r.url()) || r.method() !== 'GET') privateCalls.push(r.url()) }
  page.on('request', onRequest)
  for (const path of [`/field/scan/${section.code}/?source=printed#form`, `/work-form/${section.code}`, `/work-form?sectionId=${section.id}&objectId=${object.id}`]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Предпросмотр полей формы', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Войти как сотрудник', exact: true })).toBeVisible()
    await expect(page.getByLabel('Логин', { exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => localStorage.getItem('gp-work_token'))).toBeNull()
  }
  expect(privateCalls).toEqual([])
  page.off('request', onRequest)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('public-qr-form.png'), fullPage: true })
  const path = `/field/scan/${section.code}/?source=public#form`
  await page.route(`**/api/qr/form/${section.code}`, r => r.abort('failed'))
  await page.goto(path)
  await expect(page.getByRole('alert')).toContainText('Не удалось связаться с сервером')
  await expect(page).toHaveURL(`http://localhost:5173${path}`)
  await page.unroute(`**/api/qr/form/${section.code}`)
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click()
  await page.getByRole('link', { name: 'Войти как сотрудник', exact: true }).click()
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(`http://localhost:5173${path}`)
  await expect(page.getByRole('heading', { name: 'Просмотр формы участка', exact: true })).toBeVisible()
  await page.goto('/admin/director')
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Кабинет директора', exact: true })).toHaveCount(0)
  if (info.project.name.startsWith('mobile')) await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
  await expect(page.getByRole('link', { name: /Кабинет директора/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Сотрудники/ })).toBeVisible()
  expect(errors).toEqual([])
})
