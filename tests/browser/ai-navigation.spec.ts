import { test, expect, type Page, type APIRequestContext } from 'playwright/test'

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

async function fixture(request: APIRequestContext, suffix: string, ip: string) {
  const auth = await request.post(`${api}/auth/login`, { headers: { 'X-Forwarded-For': ip }, data: { username: adminName, password: adminPassword } })
  expect(auth.ok()).toBeTruthy()
  const { accessToken } = await auth.json()
  const headers = { Authorization: `Bearer ${accessToken}`, 'X-Forwarded-For': ip }
  const create = async (path: string, data: unknown) => {
    const response = await request.post(`${api}${path}`, { headers, data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return response.json()
  }
  const worker = await create('/users', { fullName: `AI Worker ${suffix}`, username: `ai-worker-${suffix}`, password: 'ai-worker-password', role: 'WORKER' })
  const object = await create('/objects', { name: `AI object ${suffix}` })
  const section = await create('/sections', { objectId: object.id, name: `AI section ${suffix}` })
  const workType = await create('/work-types', { name: `AI work ${suffix}` })
  const task = await create('/tasks', { sectionId: section.id, workTypeId: workType.id, assigneeUserId: worker.id,
    dueDate: '2000-01-01', description: `AI overdue ${suffix}` })
  return { worker, task, create }
}

for (const role of ['ADMIN', 'DIRECTOR'] as const) {
  test(`${role}: both AI entries stay visible and answer from real records; nursery is removed`, async ({ page, context, request }, info) => {
    const octet = info.project.name.startsWith('mobile') ? 21 : 20
    const roleId = role === 'ADMIN' ? 1 : 2
    await context.setExtraHTTPHeaders({ 'X-Forwarded-For': `10.31.${octet}.${roleId}` })
    const suffix = `${Date.now()}-${role}-${info.project.name}`
    const { task, create } = await fixture(request, suffix, `10.32.${octet}.${roleId}`)
    const user = role === 'ADMIN' ? { username: adminName } : await create('/users', {
      fullName: `AI Director ${suffix}`, username: `ai-director-${suffix}`, password: adminPassword, role,
    })
    await login(page, user.username, adminPassword)
    const shortcuts = page.getByRole('navigation', { name: 'ИИ-помощники', exact: true })
    await expect(shortcuts.getByRole('link', { name: 'ИИ-директор', exact: true })).toBeInViewport()
    await expect(shortcuts.getByRole('link', { name: 'ИИ-ассистент', exact: true })).toBeInViewport()
    await expect(page.getByRole('link', { name: 'Питомник', exact: true, includeHidden: true })).toHaveCount(0)

    await shortcuts.getByRole('link', { name: 'ИИ-директор', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'ИИ-директор', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ежедневная сводка', exact: true })).toBeVisible()
    await page.getByPlaceholder('Например: кто сегодня не ушел?').fill('Какие задачи просрочены?')
    const directorResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin-ai/question') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Спросить', exact: true }).click()
    expect((await directorResponse).status()).toBe(201)
    await expect(page.getByLabel('Ответ директора', { exact: true })).toContainText(task.description)

    await shortcuts.getByRole('link', { name: 'ИИ-ассистент', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'ИИ-ассистент', exact: true })).toBeVisible()
    await page.getByLabel('Ваш вопрос', { exact: true }).fill('Какие задачи просрочены?')
    const assistantResponse = page.waitForResponse((response) => response.url().endsWith('/api/admin-ai/question') && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Спросить', exact: true }).click()
    expect((await assistantResponse).status()).toBe(201)
    await expect(page.getByLabel('Ответ ассистента', { exact: true })).toContainText(task.description)
    await expect(page.getByLabel('Ответ ассистента', { exact: true })).toContainText('без ИИ-модели')
    await page.screenshot({ path: info.outputPath('ai-assistant.png'), fullPage: true })

    await page.goto('/admin/ai-assistant')
    await expect(page).toHaveURL(/\/admin\/ai-director$/)
    await page.goto('/admin/nursery')
    await expect(page).toHaveURL(/\/admin\/objects$/)
  })
}

test('worker can open the assistant directly and cannot access director data', async ({ page, context, request }, info) => {
  const octet = info.project.name.startsWith('mobile') ? 21 : 20
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': `10.31.${octet}.3` })
  const { worker, task } = await fixture(request, `${Date.now()}-worker-${info.project.name}`, `10.32.${octet}.3`)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  const routeResponse = page.waitForResponse((response) => response.url().endsWith('/api/routes/my/today'))
  await login(page, worker.username, 'ai-worker-password')
  expect(await (await routeResponse).json()).toBeNull()
  await expect(page.getByRole('heading', { name: task.description, exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
  const shortcuts = page.getByRole('navigation', { name: 'ИИ-помощники', exact: true })
  await expect(shortcuts.getByRole('link', { name: 'ИИ-ассистент', exact: true })).toBeInViewport()
  await expect(shortcuts.getByRole('link', { name: 'ИИ-директор', exact: true })).toHaveCount(0)
  await shortcuts.getByRole('link', { name: 'ИИ-ассистент', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'ИИ-ассистент', exact: true })).toBeVisible()
  await page.getByPlaceholder('Напишите вопрос о своей работе').fill('Какие у меня задачи?')
  const response = page.waitForResponse((response) => response.url().endsWith('/api/admin-ai/worker/question') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Спросить', exact: true }).click()
  expect((await response).status()).toBe(201)
  await expect(page.getByLabel('Ответ ассистента', { exact: true })).toContainText(task.description)
  const token = await page.evaluate(() => localStorage.getItem('gp-work_token'))
  expect((await request.get(`${api}/admin-ai/summary`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(403)
  await page.goto('/admin/ai-director')
  await expect(page).toHaveURL(/\/field\/today$/)
  await expect(page.getByRole('heading', { name: task.description, exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
})
