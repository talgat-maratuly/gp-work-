import { test, expect } from 'playwright/test'

const api = 'http://localhost:3002/api'

test('manager configures a standard; worker prepares, retries a report and sees persisted board state', async ({ page, context, request }, info) => {
  const ip = `10.85.${info.project.name.startsWith('mobile') ? 2 : 1}.1`
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
  const username = process.env.ADMIN_USERNAME || 'e2e-admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'e2e-admin-password'
  const auth = await request.post(`${api}/auth/login`, { headers: { 'X-Forwarded-For': ip }, data: { username, password: adminPassword } })
  expect(auth.ok()).toBeTruthy()
  const login = await auth.json()
  const headers = { Authorization: `Bearer ${login.accessToken}`, 'X-Forwarded-For': ip }
  async function create(path: string, data: unknown) {
    const response = await request.post(`${api}${path}`, { headers, data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return response.json()
  }
  const suffix = `${Date.now()}-${info.project.name}`
  const password = 'workflow-browser-test'
  const worker = await create('/users', { username: `flow-worker-${suffix}`, fullName: `Рабочий ${suffix}`, password, role: 'WORKER' })
  const reviewer = await create('/users', { username: `flow-reviewer-${suffix}`, fullName: `Принимающий ${suffix}`, password, role: 'DIRECTOR' })
  const object = await create('/objects', { name: `Объект ${suffix}` })
  const section = await create('/sections', { name: `Участок ${suffix}`, objectId: object.id, latitude: 51.2301, longitude: 51.3701, radiusMeters: 150 })
  const workType = await create('/work-types', { name: `Вид работ ${suffix}` })
  const standard = await create('/workflow/standards', { workTypeId: workType.id, title: `Стандарт ${suffix}`, preparation: ['Доступ на участок подтверждён'], steps: ['Выполнить работу по инструкции'], acceptance: 'Работа выполнена, участок убран' })
  const task = await create('/tasks', { sectionId: section.id, workTypeId: workType.id, assigneeUserId: worker.id, description: `Задача ${suffix}`, dueDate: '2026-09-16' })
  const taskUrl = `/workflow/tasks/${task.id}`
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  async function signIn(name: string, pass: string) {
    await page.getByLabel('Логин', { exact: true }).fill(name)
    await page.getByLabel('Пароль', { exact: true }).fill(pass)
    await page.getByRole('button', { name: 'Войти', exact: true }).click()
  }
  await page.goto(taskUrl)
  await signIn(username, adminPassword)
  await expect(page.getByRole('heading', { name: task.description, exact: true })).toBeVisible()
  const standardField = page.getByRole('combobox', { name: 'Стандарт задачи', exact: true })
  await expect(standardField).toBeVisible()
  await standardField.selectOption(String(standard.id))
  await page.getByRole('combobox', { name: 'Отвечает за результат', exact: true }).selectOption(String(login.user.id))
  await page.getByRole('combobox', { name: 'Принимает работу', exact: true }).selectOption(String(reviewer.id))
  await page.getByRole('button', { name: 'Сохранить порядок работы', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${standard.title} · версия 1`, exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText(`Принимает:`, { exact: false }).first()).toContainText(reviewer.fullName)
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto(taskUrl)
  await signIn(worker.username, password)
  await expect(page.getByRole('heading', { name: task.description, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сохранить порядок работы', exact: true })).toHaveCount(0)
  await page.getByLabel('Доступ на участок подтверждён', { exact: true }).check()
  await page.getByRole('button', { name: 'Подтвердить подготовку', exact: true }).click()
  await expect(page.getByText('Подготовка подтверждена', { exact: false })).toBeVisible()
  await expect(page.getByRole('link', { name: 'QR и прибытие', exact: true })).toHaveAttribute('href', `/field/qr?taskId=${task.id}`)

  const obstacleUrl = `**/api/workflow/tasks/${task.id}/obstacles`
  await page.route(obstacleUrl, route => route.abort('failed'))
  await page.getByRole('combobox', { name: 'Что мешает', exact: true }).selectOption('WATER')
  await page.getByLabel('Что произошло', { exact: true }).fill('Вода не доставлена на участок')
  await page.getByRole('button', { name: 'Сообщить о препятствии', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Не удалось связаться с сервером')
  await expect(page.getByLabel('Что произошло', { exact: true })).toHaveValue('Вода не доставлена на участок')
  await page.unroute(obstacleUrl)
  await page.getByRole('button', { name: 'Повторить отправку', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Препятствия · 1', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Вода не доставлена на участок', { exact: true })).toBeVisible()
  const detail = await request.get(`${api}/workflow/tasks/${task.id}`, { headers })
  expect(detail.ok()).toBeTruthy()
  const saved = await detail.json()
  expect(saved.obstacles).toHaveLength(1)
  expect(saved.obstacles[0]).toMatchObject({ reporter_id: worker.id, category: 'WATER', status: 'OPEN' })
  await page.getByRole('link', { name: '← Работа и улучшения', exact: true }).click()
  const blocked = page.locator('section').filter({ has: page.getByRole('heading', { name: /^Есть препятствие · / }) })
  const card = blocked.getByRole('link').filter({ hasText: task.description })
  await expect(card).toBeVisible()
  const geometry = await card.evaluate(element => ({ width: element.getBoundingClientRect().width, content: element.scrollWidth, available: element.clientWidth }))
  expect(geometry.width).toBeGreaterThanOrEqual(220)
  expect(geometry.content).toBeLessThanOrEqual(geometry.available + 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('workflow-board.png'), fullPage: true })
  expect(errors).toEqual([])
})
