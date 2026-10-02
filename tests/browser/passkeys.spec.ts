import { test, expect } from 'playwright/test'

const api = 'http://localhost:3002/api'
const password = 'director-passkey-test-password'
test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '10.30.0.95' } })
test('director enrolls a real WebAuthn credential, logs in, rejects replay and revokes a lost key', async ({ page, context, request }, info) => {
  const username = `passkey-${Date.now()}-${info.project.name}`
  const adminLogin = await request.post(`${api}/auth/login`, { data: {
    username: process.env.ADMIN_USERNAME || 'e2e-admin', password: process.env.ADMIN_PASSWORD || 'e2e-admin-password',
  } })
  expect(adminLogin.ok()).toBeTruthy()
  const adminToken = (await adminLogin.json()).accessToken
  const adminHeaders = { Authorization: `Bearer ${adminToken}` }
  const created = await request.post(`${api}/users`, { headers: adminHeaders,
    data: { username, password, fullName: username, role: 'DIRECTOR' } })
  expect(created.ok()).toBeTruthy()
  // An administrator cannot enroll itself or nominate another user's ID.
  expect((await request.post(`${api}/auth/passkeys/register/options`, { headers: adminHeaders,
    data: { password: process.env.ADMIN_PASSWORD || 'e2e-admin-password' } })).status()).toBe(403)
  expect((await request.get(`${api}/auth/passkeys`)).status()).toBe(401)

  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
    protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true,
    isUserVerified: true, automaticPresenceSimulation: true,
  } })
  const errors: string[] = []
  page.on('pageerror', err => errors.push(err.message))
  await page.goto('/passkeys')
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Face ID и ключи доступа' })).toBeVisible()
  const secret = page.getByLabel('Текущий пароль для управления ключами')
  await secret.fill('wrong-password')
  await page.getByRole('button', { name: 'Подключить Face ID / ключ доступа', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Неверный логин или пароль')
  await secret.fill(password)
  await page.getByRole('button', { name: 'Подключить Face ID / ключ доступа', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Ключ сохранён')
  const credentials = await cdp.send('WebAuthn.getCredentials', { authenticatorId })
  expect(credentials.credentials).toHaveLength(1)
  await page.reload()
  await expect(page.getByText('Ключ 1', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '← В кабинет' }).click()
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible()
  const verification = page.waitForRequest(req => req.url().endsWith('/passkeys/login/verify'))
  await page.getByRole('button', { name: 'Войти с Face ID / ключом', exact: true }).click()
  const signed = await verification
  await expect(page).not.toHaveURL(/\/login/)
  const signedHeaders = await signed.allHeaders()
  expect((await request.post(`${api}/auth/passkeys/login/verify`, {
    headers: { Cookie: signedHeaders.cookie || '', 'X-Forwarded-For': '10.30.0.96' }, data: signed.postDataJSON(),
  })).status()).toBe(401)
  const oldToken = await page.evaluate(() => localStorage.getItem('gp-work_token'))
  await page.goto('/passkeys')
  await expect(page.getByText(/Последний вход:/)).toBeVisible()
  await secret.fill(password)
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Удалить ключ 1', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible()
  expect((await request.get(`${api}/auth/me`, { headers: { Authorization: `Bearer ${oldToken}` } })).status()).toBe(401)
  await page.getByRole('button', { name: 'Войти с Face ID / ключом', exact: true }).click()
  await expect(page.getByText('Не удалось подтвердить ключ. Повторите вход или используйте пароль.')).toBeVisible()
  // Password fallback remains usable after revocation.
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
  expect(errors).toEqual([])
})
