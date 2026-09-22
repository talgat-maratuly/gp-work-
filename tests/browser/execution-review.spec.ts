import { test, expect } from 'playwright/test'

test.use({ actionTimeout: 15_000 })

test('real submitted work: reviewer sees evidence, returns it with a reason, then accepts corrected work', async ({ page, context, request }, info) => {
  const api = 'http://localhost:3002/api'
  const ip = `10.72.${info.project.name.startsWith('mobile') ? 2 : 1}.1`
  await context.setExtraHTTPHeaders({ 'X-Forwarded-For': ip })
  const adminName = process.env.ADMIN_USERNAME || 'e2e-admin', adminPassword = process.env.ADMIN_PASSWORD || 'e2e-admin-password'
  const loginApi = async (username: string, password: string) => {
    const response = await request.post(`${api}/auth/login`, { headers: { 'X-Forwarded-For': ip }, data: { username, password } })
    expect(response.ok()).toBeTruthy(); return response.json()
  }
  const admin = await loginApi(adminName, adminPassword)
  const adminHeaders = { Authorization: `Bearer ${admin.accessToken}`, 'X-Forwarded-For': ip }
  const post = async (path: string, data: unknown, headers = adminHeaders) => {
    const response = await request.post(api + path, { headers, data })
    expect(response.ok(), await response.text()).toBeTruthy(); return response.json()
  }
  const suffix = `${Date.now()}-${info.project.name}`, password = 'review-browser-test-password'
  const worker = await post('/users', { username: `review-worker-${suffix}`, fullName: `Рабочий ${suffix}`, role: 'WORKER', password })
  const reviewer = await post('/users', { username: `review-director-${suffix}`, fullName: `Принимающий ${suffix}`, role: 'DIRECTOR', password })
  const brigadier = await post('/users', { username: `review-no-brigade-${suffix}`, fullName: `Бригадир ${suffix}`, role: 'BRIGADIER', password })
  const workerAuth = await loginApi(worker.username, password)
  const workerHeaders = { ...adminHeaders, Authorization: `Bearer ${workerAuth.accessToken}` }
  const object = await post('/objects', { name: `Review ${suffix}` })
  const section = await post('/sections', { name: `Review section ${suffix}`, objectId: object.id, latitude: 51.2301, longitude: 51.3701, radiusMeters: 150 })
  const workType = await post('/work-types', { name: `Review type ${suffix}` })
  const task = await post('/tasks', { sectionId: section.id, workTypeId: workType.id, assigneeUserId: worker.id, description: `Работа для приёмки ${suffix}`, dueDate: '2026-09-16' })
  const standard = await post('/workflow/standards', { workTypeId: workType.id, title: `Review standard ${suffix}`, preparation: ['Участок доступен'], steps: ['Участок очищен'], acceptance: 'Мусор убран полностью' })
  await post(`/workflow/tasks/${task.id}/plan`, { standardId: standard.id, accountableId: admin.user.id, reviewerId: reviewer.id, wipLimit: 1, toolIds: [], materials: [] })
  await post(`/workflow/tasks/${task.id}/prepare`, { checked: [0] }, workerHeaders)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGOUaXJkoCVgoqnpoxaMWjBqwagFoxaMWjBqwagFoxaMWjBqARUBAB7RAR8ze0hjAAAAAElFTkSuQmCC', 'base64')
  async function upload() {
    const response = await request.post(`${api}/uploads/photos`, { headers: workerHeaders, multipart: { files: { name: 'test-evidence.png', mimeType: 'image/png', buffer: png } } })
    expect(response.ok(), await response.text()).toBeTruthy(); return (await response.json())[0]
  }
  const faces = [await upload(), await upload(), await upload()]
  let execution = await post(`/field/tasks/${task.id}/arrive`, { clientOperationId: crypto.randomUUID(), clientExecutionId: crypto.randomUUID(), sectionCode: section.code, latitude: 51.2301, longitude: 51.3701, accuracy: 5 }, workerHeaders)
  const path = `/field/executions/${execution.id}`
  execution = await post(`${path}/face`, { clientOperationId: crypto.randomUUID(), selfieUrl: faces[0], livenessEvidenceUrls: faces }, workerHeaders)
  async function photo(phase: string) { await post(`${path}/photos`, { photos: [{ clientPhotoId: crypto.randomUUID(), phase, url: await upload(), capturedAt: new Date().toISOString() }] }, workerHeaders) }
  await photo('BEFORE')
  await post(`${path}/start`, { clientOperationId: crypto.randomUUID() }, workerHeaders)
  await post(`${path}/checklist`, { clientOperationId: crypto.randomUUID(), answers: execution.availableChecklist.map((item: { id: number }) => ({ itemId: item.id, isCompleted: true })) }, workerHeaders)
  await post(`/workflow/tasks/${task.id}/steps`, { checked: [0] }, workerHeaders)
  await photo('AFTER')
  const complete = () => post(`${path}/complete`, { clientOperationId: crypto.randomUUID(), percent: 100, actualVolume: '150 м²', description: 'Участок очищен, результат приложен' }, workerHeaders)
  await complete()
  const signIn = async (username: string, pass: string) => {
    await page.goto('/login'); await page.getByLabel('Логин', { exact: true }).fill(username)
    await page.getByLabel('Пароль', { exact: true }).fill(pass); await page.getByRole('button', { name: 'Войти', exact: true }).click()
    await expect(page).not.toHaveURL(/\/login$/)
  }
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await signIn(adminName, adminPassword)
  await page.goto(`/admin/executions?execution=${execution.id}`)
  const details = page.getByRole('region', { name: 'Материалы для приёмки', exact: true })
  await expect(details).toContainText(reviewer.fullName)
  await expect(details.getByRole('button', { name: 'Принять работу', exact: true })).toHaveCount(0)
  await expect(details).toContainText('Решение принимает назначенный проверяющий')
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await signIn(reviewer.username, password)
  await page.goto(`/admin/executions?execution=${execution.id}`)
  await expect(details).toContainText('Выполнение: 100%')
  await expect(details).toContainText('Объём: 150 м²')
  await expect(details).toContainText('GPS: 51.2301, 51.3701')
  await expect(details).toContainText('Участок очищен, результат приложен')
  await expect(details.getByRole('img')).toHaveCount(5)
  await expect(details.getByRole('button', { name: 'Принять работу', exact: true })).toBeDisabled()
  await details.getByRole('button', { name: 'На доработку', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('Укажите, что сотруднику нужно исправить')
  await details.getByLabel('Что нужно исправить', { exact: true }).fill('Уберите мусор по краю участка')
  await details.getByRole('button', { name: 'На доработку', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Работа возвращена сотруднику')
  await expect(details).toHaveCount(0)
  const returned = await request.get(api + path, { headers: workerHeaders })
  expect(await returned.json()).toMatchObject({ status: 'REJECTED', reviewComment: 'Уберите мусор по краю участка' })
  await photo('AFTER'); await complete()
  await page.getByRole('button', { name: 'Обновить очередь', exact: true }).click()
  await page.getByRole('complementary', { name: 'Работы на проверке', exact: true }).getByRole('button').filter({ hasText: task.description }).click()
  await details.getByRole('button', { name: 'Подтвердить лицо', exact: true }).click()
  await expect(details.getByRole('button', { name: 'Принять работу', exact: true })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await details.screenshot({ path: info.outputPath('review-evidence.png') })
  await details.getByRole('button', { name: 'Принять работу', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Работа принята')
  await expect(details).toHaveCount(0)
  expect(await (await request.get(api + path, { headers: workerHeaders })).json()).toMatchObject({ status: 'ACCEPTED' })
  const queue = await (await request.get(`${api}/field/executions/review-queue`, { headers: adminHeaders })).json()
  expect(queue.some((row: { id: number }) => row.id === execution.id)).toBe(false)
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await signIn(brigadier.username, password)
  await page.route('**/api/field/executions/review-queue', r => r.abort('failed'))
  await page.goto('/admin/executions')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Нет работ на приёмке', exact: true })).toHaveCount(0)
  await page.unroute('**/api/field/executions/review-queue')
  await page.getByRole('button', { name: 'Обновить очередь', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Нет работ на приёмке', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Как работает приёмка', exact: true })).toContainText('Подтвердить 100% и отправить')
  expect(errors).toEqual([])
})
