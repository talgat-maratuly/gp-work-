import { test, expect, type Page, type APIRequestContext } from 'playwright/test'

const api = 'http://localhost:3002/api'
const password = 'form-test-password'

async function signIn(page: Page, username: string, pass = password) {
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill(pass)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
}

async function fixture(request: APIRequestContext, suffix: string, ip: string, role: string) {
  const auth = await request.post(`${api}/auth/login`, { headers: { 'X-Forwarded-For': ip }, data: {
    username: process.env.ADMIN_USERNAME || 'e2e-admin', password: process.env.ADMIN_PASSWORD || 'e2e-admin-password',
  } })
  expect(auth.ok()).toBeTruthy()
  const headers = { Authorization: `Bearer ${(await auth.json()).accessToken}`, 'X-Forwarded-For': ip }
  async function create(path: string, data: unknown) {
    const response = await request.post(`${api}${path}`, { headers, data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return response.json()
  }
  const user = await create('/users', { fullName: `Form ${role} ${suffix}`, username: `form-${suffix}`, password, role })
  const object = await create('/objects', { name: `Form object ${suffix}` })
  const section = await create('/sections', { objectId: object.id, name: `Form section ${suffix}` })
  return { user, object, section, headers, create }
}

for (const [index, role] of ['DIRECTOR', 'ADMIN', 'AKIMAT', 'ANTICOR'].entries()) {
  test(`${role}: open section form from Objects and QR after login, with read-only shift controls`, async ({ page, context, request }, info) => {
    const ip = `10.52.${info.project.name.startsWith('mobile') ? 2 : 1}.${index + 1}`
    await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
    const { user, section, object, headers } = await fixture(request, `${Date.now()}-${role}-${info.project.name}`, ip, role)
    const errors: string[] = []
    context.on('page', p => p.on('pageerror', e => errors.push(e.message)))
    await page.goto('/login')
    await signIn(page, user.username)
    await expect(page).not.toHaveURL(/\/login$/)
    await page.goto('/admin/objects')
    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: section.name, exact: true }) })
    const newPage = context.waitForEvent('page')
    await row.getByRole('link', { name: 'открыть', exact: true }).click()
    const form = await newPage
    await expect(form).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
    await expect(form.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    await expect(form.getByRole('heading', { name: 'Просмотр формы участка', exact: true })).toBeVisible()
    await expect(form.getByRole('alert')).toContainText('Местоположение участка не настроено')
    const qr = form.getByRole('img', { name: `QR участка ${section.code}`, exact: true })
    await expect(qr).toBeVisible()
    await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    await expect(form.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeDisabled()
    await expect(form.getByRole('button', { name: 'Включить фронтальную камеру', exact: true })).toBeDisabled()

    // Configured GPS must not turn a supervisor's preview into a worker session.
    expect((await request.patch(`${api}/sections/${section.id}`, { headers, data: { latitude: 51.2301, longitude: 51.3701, radiusMeters: 150 } })).ok()).toBeTruthy()
    await form.getByRole('button', { name: 'Обновить данные участка', exact: true }).click()
    await expect(form.getByText('Местоположение настроено.', { exact: false })).toBeVisible()
    await expect(form.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeDisabled()
    const token = await form.evaluate(() => localStorage.getItem('gp-work_token'))
    const roleHeaders = { Authorization: `Bearer ${token}`, 'X-Forwarded-For': ip }
    for (const path of ['/field/work-days/start', '/field/work-days/close']) {
      expect((await request.post(`${api}${path}`, { headers: roleHeaders, data: {} })).status()).toBe(403)
    }
    await form.screenshot({ path: info.outputPath('section-form.png'), fullPage: true })
    await form.getByRole('link', { name: '← К объектам', exact: true }).click()
    await expect(form).toHaveURL(/\/admin\/objects$/)

    // Both printed legacy QR formats must reach the same section.
    await form.goto(`/work-form/${section.code}`)
    await expect(form).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
    await form.getByRole('button', { name: 'Выйти', exact: true }).click()
    await expect(form).toHaveURL(/\/login$/)
    // Deterministically cover navigation before the logout marker is consumed.
    await form.evaluate(() => sessionStorage.setItem('gp-work_signed_out', '1'))
    await form.goto(`/work-form?objectId=${object.id}&sectionId=${section.id}`)
    await expect(form).toHaveURL(/\/login$/)
    await signIn(form, user.username)
    await expect(form).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
    await expect(form.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    await form.getByRole('button', { name: 'Выйти', exact: true }).click()
    await expect(form).toHaveURL(/\/login$/)
    await form.goto(`/field/scan/${section.code}`)
    await expect(form).toHaveURL(/\/login$/)
    await signIn(form, user.username)
    await expect(form.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    await form.goto('/field/scan/unknown-section-form-test')
    await expect(form.getByRole('alert')).toContainText('Участок не найден')
    await expect(form.getByRole('link', { name: '← К объектам', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('worker: legacy QR retains section through login and opens the real form; accountant stays restricted', async ({ page, context, request }, info) => {
  const ip = `10.53.${info.project.name.startsWith('mobile') ? 2 : 1}.1`
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
  const { user, section, object, headers, create } = await fixture(request, `${Date.now()}-${info.project.name}`, ip, 'WORKER')
  await page.goto(`/work-form?objectId=${object.id}&sectionId=${section.id}`)
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page, user.username)
  await expect(page).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
  await expect(page.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Просмотр формы участка', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeDisabled()
  expect((await request.patch(`${api}/sections/${section.id}`, { headers, data: { latitude: 51.2301, longitude: 51.3701 } })).ok()).toBeTruthy()
  await page.getByRole('button', { name: 'Обновить данные участка', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Включить фронтальную камеру', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Начать рабочий день', exact: true }).click()
  await expect(page.getByText('Обязательны три кадра лица и фото участка', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  const accountant = await create('/users', { fullName: 'Form accountant', username: `form-accountant-${Date.now()}`, password, role: 'ACCOUNTANT' })
  await page.goto(`/field/scan/${section.code}`)
  await signIn(page, accountant.username)
  await expect(page).toHaveURL(/\/admin\/attendance$/)
  const token = await page.evaluate(() => localStorage.getItem('gp-work_token'))
  const roleHeaders = { Authorization: `Bearer ${token}`, 'X-Forwarded-For': ip }
  for (const path of [`/sections/${section.id}`, `/sections/code/${section.code}`, `/field/scan/${section.code}`]) {
    expect((await request.get(`${api}${path}`, { headers: roleHeaders })).status()).toBe(403)
  }
})
