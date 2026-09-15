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
    page.on('pageerror', e => errors.push(e.message))
    context.on('page', p => p.on('pageerror', e => errors.push(e.message)))
    await page.goto('/login')
    await signIn(page, user.username)
    await expect(page).not.toHaveURL(/\/login$/)
    await page.goto('/admin/objects')
    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: section.name, exact: true }) })
    await row.getByRole('link', { name: 'открыть', exact: true }).click()
    const form = page
    await expect(form).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
    expect(context.pages()).toHaveLength(1)
    await expect(form.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    await expect(form.getByRole('heading', { name: 'Просмотр формы участка', exact: true })).toBeVisible()
    await expect(form.getByRole('alert')).toContainText('Местоположение участка не настроено')
    const qr = form.getByRole('img', { name: `QR участка ${section.code}`, exact: true })
    await expect(qr).toBeVisible()
    await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0)
    await expect(form.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeDisabled()
    await expect(form.getByRole('button', { name: 'Включить фронтальную камеру', exact: true })).toBeDisabled()
    if (role === 'AKIMAT' || role === 'ANTICOR') {
      await expect(form.getByRole('button', { name: 'Настроить местоположение участка', exact: true })).toHaveCount(0)
    }

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

    if (role === 'ADMIN') {
      await form.goto('/admin/qr')
      const qrRow = form.getByRole('row').filter({ has: form.getByRole('cell', { name: section.name, exact: true }) })
      await qrRow.getByRole('button', { name: 'Открыть форму', exact: true }).click()
      await expect(form).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
      await expect(form.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
      expect(context.pages()).toHaveLength(1)
      await form.getByRole('link', { name: '← К объектам', exact: true }).click()
      await form.goto('/admin/qr')
      await qrRow.getByRole('link').click()
      await expect(form).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
      await expect(form.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
      expect(context.pages()).toHaveLength(1)
    }

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
  await expect(page.getByRole('button', { name: 'Настроить местоположение участка', exact: true })).toHaveCount(0)
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

for (const [index, role] of ['DIRECTOR', 'ADMIN'].entries()) {
  test(`${role}: configure location inside section form, retain draft on failure and preserve QR`, async ({ page, context, request }, info) => {
    const ip = `10.54.${info.project.name.startsWith('mobile') ? 2 : 1}.${index + 1}`
    await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
    const { user, section, object, headers, create } = await fixture(request, `${Date.now()}-location-${role}-${info.project.name}`, ip, role)
    const untouched = await create('/sections', { objectId: object.id, name: `Untouched ${section.code}` })
    await page.goto(`/field/scan/${section.code}`)
    await signIn(page, user.username)
    await expect(page.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    const qr = page.getByRole('img', { name: `QR участка ${section.code}`, exact: true })
    const qrSource = await qr.getAttribute('src')
    const openEditor = page.getByRole('button', { name: 'Настроить местоположение участка', exact: true })
    await openEditor.click()
    const editor = page.getByRole('form', { name: 'Настройка местоположения участка', exact: true })
    await expect(editor).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/field/scan/${section.code}$`))
    await editor.getByRole('button', { name: 'Сохранить координаты', exact: true }).click()
    await expect(editor.getByRole('alert')).toHaveText('Укажите широту и долготу вместе')
    await editor.getByLabel('Широта', { exact: true }).fill('51,2301')
    await editor.getByLabel('Долгота', { exact: true }).fill('51,3701')
    await editor.getByLabel('Радиус, м', { exact: true }).fill('250')

    // Only this failed request is simulated. The successful retry uses the real API/database.
    const endpoint = `**/api/sections/${section.id}`
    await page.route(endpoint, route => route.request().method() === 'PATCH' ? route.abort('failed') : route.continue())
    await editor.getByRole('button', { name: 'Сохранить координаты', exact: true }).click()
    await expect(editor.getByRole('alert')).toContainText('Не удалось связаться с сервером')
    await expect(editor.getByLabel('Широта', { exact: true })).toHaveValue('51,2301')
    await expect(page.getByText('Местоположение настроено.', { exact: false })).toHaveCount(0)
    await page.unroute(endpoint)

    await editor.getByRole('button', { name: 'Сохранить координаты', exact: true }).click()
    await expect(editor).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveText('Координаты участка сохранены. QR остался прежним.')
    await expect(page.getByText('Местоположение настроено. Радиус участка: 250 м.', { exact: true })).toBeVisible()
    await expect(qr).toHaveAttribute('src', qrSource!)
    expect(context.pages()).toHaveLength(1)
    await expect(page.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeDisabled()
    await page.reload()
    await expect(page.getByText('Местоположение настроено. Радиус участка: 250 м.', { exact: true })).toBeVisible()
    await openEditor.click()
    await expect(editor.getByLabel('Широта', { exact: true })).toHaveValue('51.2301')
    await editor.getByLabel('Радиус, м', { exact: true }).fill('500')
    await editor.getByRole('button', { name: 'Отмена', exact: true }).click()
    await openEditor.click()
    await expect(editor.getByLabel('Радиус, м', { exact: true })).toHaveValue('250')
    await editor.screenshot({ path: info.outputPath('inline-location-editor.png') })
    await editor.getByRole('button', { name: 'Отмена', exact: true }).click()

    const persisted = await request.get(`${api}/sections/${section.id}`, { headers })
    expect(persisted.ok()).toBeTruthy()
    expect(await persisted.json()).toMatchObject({ code: section.code, name: section.name, latitude: 51.2301, longitude: 51.3701, radiusMeters: 250 })
    const other = await request.get(`${api}/sections/${untouched.id}`, { headers })
    expect(other.ok()).toBeTruthy()
    expect(await other.json()).toMatchObject({ latitude: null, longitude: null })
    const worker = await create('/users', { fullName: 'Location worker', username: `loc-worker-${section.id}`, password, role: 'WORKER' })
    await page.getByRole('button', { name: 'Выйти', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto(`/field/scan/${section.code}`)
    await signIn(page, worker.username)
    await expect(page.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Начать рабочий день', exact: true })).toBeEnabled()
    await expect(openEditor).toHaveCount(0)
    const token = await page.evaluate(() => localStorage.getItem('gp-work_token'))
    const denied = await request.patch(`${api}/sections/${section.id}`, { headers: { Authorization: `Bearer ${token}`, 'X-Forwarded-For': ip }, data: { radiusMeters: 500 } })
    expect(denied.status()).toBe(403)
  })
}
