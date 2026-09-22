import { test, expect } from 'playwright/test'

const api = 'http://localhost:3002/api'

test('director resets a lost password, worker must replace it and returns to the original QR', async ({ page, context, request }, info) => {
  const ip = `10.68.${info.project.name.startsWith('mobile') ? 2 : 1}.1`
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
  const auth = await request.post(`${api}/auth/login`, { headers: { 'X-Forwarded-For': ip }, data: {
    username: process.env.ADMIN_USERNAME || 'e2e-admin', password: process.env.ADMIN_PASSWORD || 'e2e-admin-password',
  } })
  expect(auth.ok()).toBeTruthy()
  const headers = { Authorization: `Bearer ${(await auth.json()).accessToken}`, 'X-Forwarded-For': ip }
  const create = async (path: string, data: object) => {
    const response = await request.post(`${api}${path}`, { headers, data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return response.json()
  }
  const suffix = `${Date.now()}-${info.project.name}`
  const password = 'browser-original-test-password'
  const director = await create('/users', { fullName: `Recovery director ${suffix}`, username: `reset-dir-${suffix}`, password, role: 'DIRECTOR' })
  const worker = await create('/users', { fullName: `Recovery worker ${suffix}`, username: `reset-worker-${suffix}`, password, role: 'WORKER' })
  const object = await create('/objects', { name: `Recovery object ${suffix}` })
  const section = await create('/sections', { name: `Recovery section ${suffix}`, objectId: object.id, latitude: 51.2301, longitude: 51.3701, radiusMeters: 150 })
  const signIn = async (username: string, secret: string) => {
    await page.getByLabel('Логин', { exact: true }).fill(username)
    await page.getByLabel('Пароль', { exact: true }).fill(secret)
    await page.getByRole('button', { name: 'Войти', exact: true }).click()
  }
  const errors: string[] = []
  page.on('pageerror', err => errors.push(err.message))
  await page.goto('/admin/users')
  await signIn(director.username, password)
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: worker.username, exact: true }) })
  let resetCalls = 0
  page.on('request', req => { if (req.url().endsWith(`/users/${worker.id}/password-reset`)) resetCalls++ })
  await row.getByRole('button', { name: 'Сбросить пароль', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Сброс пароля', exact: true })
  await expect(dialog).toContainText(worker.username)
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
  expect(resetCalls).toBe(0)
  await row.getByRole('button', { name: 'Сбросить пароль', exact: true }).click()
  let lostSecret = ''
  await page.route(`**/users/${worker.id}/password-reset`, async route => {
    const response = await route.fetch()
    expect(response.ok()).toBeTruthy()
    lostSecret = (await response.json()).temporaryPassword
    await route.abort('failed')
  })
  await dialog.getByRole('button', { name: 'Создать временный пароль', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Не удалось связаться')
  await expect(dialog).toContainText('сброс мог выполниться')
  await expect(dialog.getByLabel('Данные для входа', { exact: true })).toHaveCount(0)
  await page.unroute(`**/users/${worker.id}/password-reset`)
  await dialog.getByRole('button', { name: 'Создать другой временный пароль', exact: true }).click()
  const text = await dialog.getByLabel('Данные для входа', { exact: true }).inputValue()
  const temporary = text.split('Временный пароль: ')[1]
  expect(temporary).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{16}$/)
  expect(temporary).not.toBe(lostSecret)
  expect((await request.post(`${api}/auth/login`, { headers: { 'X-Forwarded-For': ip.replace(/\.1$/, '.10') }, data: { username: worker.username, password: lostSecret } })).status()).toBe(401)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await dialog.getByRole('button', { name: 'Скопировать логин и пароль', exact: true }).click()
  await expect(dialog.getByText('Логин и временный пароль скопированы.', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text)
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('Permission denied') } }) })
  await dialog.getByRole('button', { name: 'Скопировать логин и пароль', exact: true }).click()
  await expect(dialog).toContainText('скопируйте его вручную')
  expect(await page.evaluate(secret => !JSON.stringify({ ...localStorage, ...sessionStorage }).includes(secret), temporary)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('password-reset.png'), mask: [dialog.getByLabel('Данные для входа', { exact: true })] })
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await expect(row).toContainText('Нужно сменить пароль')
  await page.reload()
  await expect(row).toContainText('Нужно сменить пароль')
  await expect(page.getByLabel('Данные для входа', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  const destination = `/field/scan/${section.code}/?source=recovery#form`
  await page.goto(destination)
  await signIn(worker.username, temporary)
  await expect(page.getByRole('heading', { name: 'Установите свой пароль', exact: true })).toBeVisible()
  const limitedToken = await page.evaluate(() => localStorage.getItem('gp-work_token'))
  expect((await request.get(`${api}/sections`, { headers: { Authorization: `Bearer ${limitedToken}` } })).status()).toBe(403)
  // Even a manually typed protected URL returns to the forced change screen.
  await page.goto(destination)
  await expect(page).toHaveURL(/\/change-password$/)
  await page.reload()
  const form = page.getByRole('form', { name: 'Смена пароля', exact: true })
  await expect(form.getByLabel('Текущий пароль', { exact: true })).toHaveCount(0)
  const personal = 'browser-personal-test-password'
  await form.getByLabel('Новый пароль', { exact: true }).fill(personal)
  await form.getByLabel('Повторите новый пароль', { exact: true }).fill('does-not-match')
  await form.getByRole('button', { name: 'Сохранить пароль', exact: true }).click()
  await expect(form.getByRole('alert')).toHaveText('Пароли не совпадают.')
  await form.getByLabel('Повторите новый пароль', { exact: true }).fill(personal)
  await page.screenshot({ path: info.outputPath('set-personal-password.png') })
  await form.getByRole('button', { name: 'Сохранить пароль', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Пароль изменён. Войдите с новым паролем.')
  await signIn(worker.username, personal)
  await expect(page).toHaveURL(new RegExp(`/field/scan/${section.code}/\\?source=recovery#form$`))
  await expect(page.getByRole('heading', { name: section.name, exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('employee can change own password and recover when the successful response is lost', async ({ page, context, request }, info) => {
  const ip = `10.68.${info.project.name.startsWith('mobile') ? 2 : 1}.2`
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
  const admin = await request.post(`${api}/auth/login`, { headers: { 'X-Forwarded-For': ip }, data: {
    username: process.env.ADMIN_USERNAME || 'e2e-admin', password: process.env.ADMIN_PASSWORD || 'e2e-admin-password',
  } })
  expect(admin.ok()).toBeTruthy()
  const username = `own-password-${Date.now()}-${info.project.name}`
  const password = 'own-password-before-change'
  expect((await request.post(`${api}/users`, { headers: { Authorization: `Bearer ${(await admin.json()).accessToken}` }, data: { username, fullName: 'Self change test', password, role: 'ACCOUNTANT' } })).ok()).toBeTruthy()
  await page.goto('/admin/attendance')
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  // All roles can use the account menu, including an accountant.
  await page.getByRole('link', { name: 'Сменить пароль', exact: true }).click()
  const form = page.getByRole('form', { name: 'Смена пароля', exact: true })
  await form.getByLabel('Текущий пароль', { exact: true }).fill('incorrect-password')
  await form.getByLabel('Новый пароль', { exact: true }).fill('personal-after-change')
  await form.getByLabel('Повторите новый пароль', { exact: true }).fill('personal-after-change')
  await form.getByRole('button', { name: 'Сохранить пароль', exact: true }).click()
  await expect(form.getByRole('alert')).toHaveText('Текущий пароль указан неверно.')
  await form.getByLabel('Текущий пароль', { exact: true }).fill(password)
  await page.route('**/api/auth/password', async route => {
    const response = await route.fetch()
    expect(response.ok()).toBeTruthy()
    await route.abort('failed')
  })
  await form.getByRole('button', { name: 'Сохранить пароль', exact: true }).click()
  await expect(form).toContainText('Ответ сервера не подтверждён')
  await page.unroute('**/api/auth/password')
  await form.getByRole('button', { name: 'Перейти ко входу', exact: true }).click()
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill('personal-after-change')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/attendance$/)
})
