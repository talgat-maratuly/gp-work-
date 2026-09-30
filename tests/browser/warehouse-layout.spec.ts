import { test, expect } from 'playwright/test'

const api = 'http://localhost:3002/api'
test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '10.30.0.47' } })

test('warehouse movement form fits the viewport with long task names', async ({ page, request }, info) => {
  const suffix = `${Date.now()}-${info.project.name}`
  const login = await request.post(`${api}/auth/login`, { data: {
    username: process.env.ADMIN_USERNAME || 'e2e-admin', password: process.env.ADMIN_PASSWORD || 'e2e-admin-password',
  } })
  expect(login.ok()).toBeTruthy()
  const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` }
  async function create(path: string, data: unknown) {
    const response = await request.post(`${api}${path}`, { headers, data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return response.json()
  }
  const director = `warehouse-director-${suffix}`
  const password = 'warehouse-browser-password'
  await create('/users', { username: director, fullName: 'Директор склада', password, role: 'DIRECTOR' })
  const worker = await create('/users', { username: `warehouse-worker-${suffix}`, fullName: 'Рабочий склада', password, role: 'WORKER' })
  const object = await create('/objects', { name: `Объект ${suffix}` })
  const section = await create('/sections', { name: `Участок ${suffix}`, objectId: object.id })
  const workType = await create('/work-types', { name: `Работы ${suffix}` })
  const task = await create('/tasks', { sectionId: section.id, workTypeId: workType.id, assigneeUserId: worker.id,
    description: `Доставить материалы для обслуживания системы автоматического полива и озеленения на удалённом участке ${suffix}`, dueDate: '2026-09-30' })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/admin/warehouse/issue')
  await page.getByLabel('Логин', { exact: true }).fill(director)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Склад', exact: true })).toBeVisible()
  const form = page.getByRole('form', { name: 'Движение товара', exact: true })
  const taskSelect = form.locator('select').filter({ has: page.getByRole('option', { name: `#${task.id} ${task.description}`, exact: true }) })
  await taskSelect.selectOption(String(task.id))
  await form.getByPlaceholder('Количество *', { exact: true }).fill('2')
  for (const width of info.project.name.startsWith('mobile') ? [360, 390, 430] : [768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
    const overflow = await form.evaluate(element => {
      const bounds = element.getBoundingClientRect()
      return Array.from(element.querySelectorAll('input, select, textarea, button')).filter(field => {
        const rect = field.getBoundingClientRect()
        return rect.left < bounds.left || rect.right > bounds.right + 1
      }).map(field => field.tagName)
    })
    expect(overflow).toEqual([])
    await expect(form.getByRole('button', { name: 'Закрыть', exact: true })).toBeVisible()
    await expect(form.getByRole('button', { name: 'Сохранить движение', exact: true })).toBeEnabled()
    await expect(form.getByPlaceholder('Количество *', { exact: true })).toHaveValue('2')
    await page.screenshot({ path: info.outputPath(`warehouse-${width}.png`), fullPage: true })
  }
  // The wide stock table remains scrollable inside its own container.
  const table = page.locator('table').first()
  expect(await table.evaluate(element => {
    const parent = element.parentElement!
    return parent.getBoundingClientRect().right <= window.innerWidth + 1 && getComputedStyle(parent).overflowX === 'auto'
  })).toBe(true)
  await form.getByRole('button', { name: 'Закрыть', exact: true }).click()
  await expect(form).toHaveCount(0)
  await page.getByRole('button', { name: 'Выдать / списать товар', exact: true }).click()
  await expect(form).toBeVisible()
  expect(errors).toEqual([])
})
