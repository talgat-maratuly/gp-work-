import { test, expect, type Page } from 'playwright/test'

const api = 'http://localhost:3002/api'
const adminName = process.env.ADMIN_USERNAME || 'e2e-admin'
const adminPassword = process.env.ADMIN_PASSWORD || 'e2e-admin-password'
const password = 'role-assistant-test-password'

async function signIn(page: Page, username: string, pass = password) {
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill(pass)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

for (const [role, label] of [['AGRONOMIST', 'Агроном'], ['BRIGADIER', 'Бригадир'], ['WATER_CARRIER', 'Водовоз']] as const) {
  test(`${role}: own context, working exits, protected director and account switching`, async ({ page, context, request }, info) => {
    const octet = info.project.name.startsWith('mobile') ? 61 : 60
    const roleId = { AGRONOMIST: 1, BRIGADIER: 2, WATER_CARRIER: 3 }[role]
    const headers = { 'X-Forwarded-For': `10.33.${octet}.${roleId}` }
    await context.setExtraHTTPHeaders({ 'X-Forwarded-For': `10.34.${octet}.${roleId}` })
    const login = async (username: string, pass: string) => {
      const response = await request.post(`${api}/auth/login`, { headers, data: { username, password: pass } })
      expect(response.ok()).toBeTruthy()
      return (await response.json()).accessToken as string
    }
    const token = await login(adminName, adminPassword)
    const create = async (path: string, data: unknown, actor = token) => {
      const response = await request.post(`${api}${path}`, { headers: { ...headers, Authorization: `Bearer ${actor}` }, data })
      expect(response.ok(), await response.text()).toBeTruthy()
      return response.json()
    }
    const suffix = `${Date.now()}-${role}-${info.project.name}`
    const employee = await create('/users', { fullName: `Role ${label} ${suffix}`, username: `role-${suffix}`, password, role })
    const worker = await create('/users', { fullName: `Role worker ${suffix}`, username: `rw-${suffix}`, password, role: 'WORKER' })
    const outsider = await create('/users', { fullName: `Outside ${suffix}`, username: `ro-${suffix}`, password, role: 'WORKER' })
    if (role === 'BRIGADIER') await create('/brigades', { name: `Team ${suffix}`, brigadierId: employee.id, workerIds: [worker.id] })
    const actorToken = await login(employee.username, password)
    const object = await create('/objects', { name: `Role park ${suffix}` })
    const section = await create('/sections', { objectId: object.id, name: `Role section ${suffix}` })
    const workType = await create('/work-types', { name: `Role work ${suffix}` })
    const own = await create('/tasks', { sectionId: section.id, workTypeId: workType.id, assigneeUserId: role === 'WATER_CARRIER' ? employee.id : worker.id,
      dueDate: '2001-01-01', description: `Own responsibility ${suffix}` }, role === 'WATER_CARRIER' ? token : actorToken)
    const other = await create('/tasks', { sectionId: section.id, workTypeId: workType.id, assigneeUserId: outsider.id,
      dueDate: '2001-01-01', description: `PRIVATE OTHER ${suffix}` })
    let wateringId: number | undefined
    if (role === 'WATER_CARRIER') {
      const workDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Oral', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      wateringId = (await create('/watering', { workDate, shift: 'DAY', type: 'WATER_CARRIER', objectId: object.id, waterCarrierId: employee.id, plannedLiters: 7000 })).id
    }
    const pageErrors: string[] = []
    page.on('pageerror', error => pageErrors.push(error.message))
    await page.goto('/login')
    await signIn(page, employee.username)
    await expect(page.getByLabel('Текущий аккаунт')).toContainText(label)
    const shortcuts = page.getByRole('navigation', { name: 'ИИ-помощники', exact: true })
    const briefResponse = page.waitForResponse(r => r.url().endsWith('/api/admin-ai/worker/brief'))
    await shortcuts.getByRole('link', { name: 'ИИ-ассистент', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/assistant$/)
    const brief = await (await briefResponse).json()
    expect(brief.tasks.map((t: { id: number }) => t.id)).toContain(own.id)
    expect(brief.tasks.map((t: { id: number }) => t.id)).not.toContain(other.id)
    if (wateringId) expect(brief.watering.map((w: { id: number }) => w.id)).toContain(wateringId)
    await expect(page.getByRole('heading', { name: 'ИИ-ассистент', exact: true })).toBeVisible()
    await expect(page.getByText(brief.assistant.title, { exact: true })).toBeVisible()
    const ask = async (question: string) => {
      await page.getByPlaceholder('Напишите вопрос о своей работе').fill(question)
      const answer = page.waitForResponse(r => r.url().endsWith('/api/admin-ai/worker/question') && r.request().method() === 'POST')
      await page.getByRole('button', { name: 'Спросить', exact: true }).click()
      expect((await answer).status()).toBe(201)
      return page.getByLabel('Ответ ассистента', { exact: true })
    }
    await expect(await ask(role === 'WATER_CARRIER' ? 'Какие поливы мне назначены?' : 'Какие мои задачи просрочены?')).toContainText(role === 'WATER_CARRIER' ? '7000 л' : own.description)
    await expect(page.getByLabel('Ответ ассистента', { exact: true })).not.toContainText(other.description)
    await expect(await ask('Что мне делать сейчас?')).not.toContainText('отсканируйте QR')
    await expect(await ask('Почему небо синее?')).toContainText('нет надёжного ответа')
    await expect(shortcuts.getByRole('link', { name: '← В кабинет', exact: true })).toBeInViewport()
    await shortcuts.getByRole('link', { name: '← В кабинет', exact: true }).click()
    await expect(page).toHaveURL(role === 'WATER_CARRIER' ? /\/admin\/watering$/ : /\/admin$/)
    await page.goto('/field/assistant')
    await expect(page).toHaveURL(/\/admin\/assistant$/)
    await expect(page.getByRole('heading', { name: 'ИИ-ассистент', exact: true })).toBeVisible()
    for (const endpoint of ['/admin-ai/summary', '/admin-ai/risks']) {
      expect((await request.get(`${api}${endpoint}`, { headers: { ...headers, Authorization: `Bearer ${actorToken}` } })).status()).toBe(403)
    }
    expect((await request.post(`${api}/admin-ai/assistant/question`, { headers: { ...headers, Authorization: `Bearer ${actorToken}` }, data: { question: 'Сводка' } })).status()).toBe(403)
    await expect(shortcuts.getByRole('link', { name: 'ИИ-директор', exact: true })).toHaveCount(0)
    await page.screenshot({ path: info.outputPath(`assistant-${role}.png`), fullPage: true })

    let releaseLogout: () => void = () => {}
    if (role === 'AGRONOMIST') {
      const gate = new Promise<void>(resolve => { releaseLogout = resolve })
      await page.route('**/api/auth/logout', async route => {
        const response = await route.fetch() // Real API; delay only the cookie response to reproduce a slow mobile network.
        await gate
        await route.fulfill({ response })
      })
    }
    await page.getByRole('button', { name: 'Выйти', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(await page.evaluate(() => localStorage.getItem('gp-work_token'))).toBeNull()
    if (role === 'AGRONOMIST') {
      const director = await create('/users', { fullName: `Director replacement ${suffix}`, username: `rd-${suffix}`, password, role: 'DIRECTOR' })
      await page.getByLabel('Логин', { exact: true }).fill(director.username)
      await page.getByLabel('Пароль', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Войти', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Вход…', exact: true })).toBeVisible()
      releaseLogout()
      await expect(page).toHaveURL(/\/admin\/director$/)
      await expect(page.getByLabel('Текущий аккаунт')).toContainText(director.fullName)
      await expect(shortcuts.getByRole('link', { name: 'ИИ-директор', exact: true })).toBeInViewport()
      await shortcuts.getByRole('link', { name: 'ИИ-ассистент', exact: true }).click()
      await expect(page.getByText('Помощник руководителя:', { exact: false })).toBeVisible()
      expect((await context.cookies()).find(c => c.name === 'gp_work_media')?.value)
        .toBe(await page.evaluate(() => localStorage.getItem('gp-work_token')))
      await page.reload()
      await expect(page.getByLabel('Текущий аккаунт')).toContainText(director.fullName)
    } else {
      await page.reload()
      await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible()
    }
    expect(pageErrors).toEqual([])
  })
}
