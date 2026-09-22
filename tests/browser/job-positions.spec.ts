import { test, expect } from 'playwright/test'

const api = 'http://localhost:3002/api'
test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '10.30.0.46' } })

test('director manages job positions and employee assignment without changing access roles', async ({ page, request }, info) => {
  const suffix = `${Date.now()}-${info.project.name}`
  const login = await request.post(`${api}/auth/login`, { data: {
    username: process.env.ADMIN_USERNAME || 'e2e-admin', password: process.env.ADMIN_PASSWORD || 'e2e-admin-password',
  } })
  expect(login.ok()).toBeTruthy()
  const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` }
  const director = `positions-director-${suffix}`
  const password = 'positions-browser-password'
  expect((await request.post(`${api}/users`, { headers, data: { username: director, fullName: director, password, role: 'DIRECTOR' } })).ok()).toBeTruthy()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/admin/users')
  await page.getByLabel('Логин', { exact: true }).fill(director)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Пользователи', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Создать пользователя', exact: true })).toBeEnabled()
  const name = `Снабженец ${suffix}`
  await page.getByLabel('Название новой должности', { exact: true }).fill(name)
  await page.route('**/api/job-positions', route => route.request().method() === 'POST' ? route.abort('failed') : route.continue())
  await page.getByRole('button', { name: 'Добавить должность', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Не удалось связаться с сервером')
  await expect(page.getByLabel('Название новой должности', { exact: true })).toHaveValue(name)
  await page.unroute('**/api/job-positions')
  await page.getByRole('button', { name: 'Добавить должность', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Должность добавлена')
  const create = page.getByRole('form', { name: 'Создание сотрудника', exact: true })
  await expect(create.getByLabel('Должность', { exact: true })).toBeVisible()
  await expect(create.getByLabel('Роль доступа', { exact: true })).toBeVisible()
  await create.getByLabel('Должность', { exact: true }).selectOption({ label: name })
  await expect(create.getByLabel('Роль доступа', { exact: true })).toHaveValue('WORKER')
  const workerName = `positions-worker-${suffix}`
  await create.getByLabel('ФИО', { exact: true }).fill(workerName)
  await create.getByLabel('Логин сотрудника', { exact: true }).fill(workerName)
  await create.getByLabel('Пароль сотрудника', { exact: true }).fill(password)
  await create.getByRole('button', { name: 'Создать пользователя', exact: true }).click()
  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: workerName, exact: true }) })
  await expect(row).toContainText(name)
  await page.reload()
  await expect(row).toContainText(name)
  await page.getByText(/^Все должности и архив/).click()
  let position = page.getByRole('listitem', { name: `Должность ${name}`, exact: true })
  await position.getByRole('button', { name: 'Переименовать', exact: true }).click()
  const renamed = `Старший снабженец ${suffix}`
  await position.getByLabel('Новое название должности', { exact: true }).fill(renamed)
  await position.getByRole('button', { name: 'Сохранить название', exact: true }).click()
  await expect(row).toContainText(renamed)
  position = page.getByRole('listitem', { name: `Должность ${renamed}`, exact: true })
  await position.getByRole('button', { name: 'В архив', exact: true }).click()
  await expect(row).toContainText('(в архиве)')
  await expect(create.getByLabel('Должность', { exact: true }).getByRole('option', { name: renamed, exact: true })).toHaveCount(0)
  await row.getByRole('button', { name: 'Изменить', exact: true }).click()
  const edit = page.getByRole('form', { name: 'Редактирование сотрудника', exact: true })
  expect(await page.locator('main [id]').evaluateAll(elements => {
    const ids = elements.map(element => element.id)
    return ids.length === new Set(ids).size
  })).toBe(true)
  await expect(edit.getByLabel('Должность', { exact: true }).locator('option:checked')).toHaveText(`${renamed} (в архиве)`)
  await edit.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(edit).toHaveCount(0)
  await expect(row).toContainText(renamed)
  await position.getByRole('button', { name: 'Восстановить', exact: true }).click()
  await expect(row).not.toContainText('(в архиве)')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('job-positions.png'), fullPage: true })
  await row.getByRole('button', { name: 'Изменить', exact: true }).click()
  await edit.getByLabel('Должность', { exact: true }).selectOption('')
  await edit.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(edit).toHaveCount(0)
  await page.reload()
  await expect(row).not.toContainText(renamed)
  await expect(row).toContainText('Рабочий')
  await page.route('**/api/job-positions', route => route.abort('failed'))
  await page.reload()
  await expect(page.getByText('Не удалось загрузить сотрудников и должности.', { exact: false })).toBeVisible()
  await expect(create.getByRole('button', { name: 'Создать пользователя', exact: true })).toBeDisabled()
  await page.unroute('**/api/job-positions')
  await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click()
  await expect(create.getByRole('button', { name: 'Создать пользователя', exact: true })).toBeEnabled()
  expect(errors).toEqual([])
})
