import { test, expect, type Page } from 'playwright/test'

const api = 'http://localhost:3002/api'
const adminName = process.env.ADMIN_USERNAME || 'e2e-admin'
const adminPassword = process.env.ADMIN_PASSWORD || 'e2e-admin-password'
// A separate simulated client keeps this scenario's repeated logins from using
// another scenario's rate-limit budget. Production throttling stays enabled.
test.use({ extraHTTPHeaders: { 'X-Forwarded-For': '10.30.0.45' } })
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGOUaXJkoCVgoqnpoxaMWjBqwagFoxaMWjBqwagFoxaMWjBqARUBAB7RAR8ze0hjAAAAAElFTkSuQmCC', 'base64')

async function login(page: Page, username: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

async function evidence(page: Page) {
  await page.getByRole('button', { name: 'Включить фронтальную камеру', exact: true }).click()
  for (let i = 1; i <= 3; i++) await page.getByRole('button', { name: `Снять кадр ${i} из 3`, exact: true }).click()
  await page.locator('input[type="file"]').setInputFiles({ name: 'work.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('button', { name: 'Переснять', exact: true })).toBeVisible()
}

test('configured day fields: admin authoring, persisted worker values, retry and manager review', async ({ page, request }, testInfo) => {
  const suffix = `${Date.now()}-${testInfo.project.name}`
  const auth = await request.post(`${api}/auth/login`, { data: { username: adminName, password: adminPassword } })
  expect(auth.ok()).toBeTruthy()
  const headers = { Authorization: `Bearer ${(await auth.json()).accessToken}` }
  const settingsUrl = `${api}/form-settings?form=field_day_form`
  const original = await (await request.get(settingsUrl, { headers })).json()
  const legacyWork = await (await request.get(`${api}/form-settings?form=work_form`, { headers })).json()
  const legacyCheckout = await (await request.get(`${api}/form-settings?form=checkout_form`, { headers })).json()
  const create = async (path: string, data: unknown) => {
    const response = await request.post(`${api}${path}`, { headers, data })
    expect(response.ok(), await response.text()).toBeTruthy()
    return response.json()
  }
  try {
    await login(page, adminName, adminPassword)
    await page.route('**/api/form-settings?form=field_day_form', route => route.request().method() === 'GET' ? route.abort('failed') : route.continue())
    await page.goto('/admin/form-settings')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
    await page.unroute('**/api/form-settings?form=field_day_form')
    await page.getByRole('button', { name: 'Повторить загрузку', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled()
    for (const [label, type] of [['Расход воды', 'number'], ['Проверено', 'boolean']]) {
      await page.getByRole('textbox', { name: 'Название', exact: true }).fill(label)
      await page.getByRole('combobox', { name: 'Тип', exact: true }).selectOption(type)
      await page.getByRole('button', { name: 'Добавить', exact: true }).click()
      const card = page.getByRole('group', { name: `Поле ${label}`, exact: true })
      await card.getByRole('checkbox', { name: 'Обязательное поле', exact: true }).check()
    }
    await page.getByRole('textbox', { name: 'Название', exact: true }).fill('Скрытый комментарий')
    await page.getByRole('combobox', { name: 'Тип', exact: true }).selectOption('text')
    await page.getByRole('button', { name: 'Добавить', exact: true }).click()
    for (const label of ['Скрытый комментарий', 'Фактический объём']) {
      const card = page.getByRole('group', { name: `Поле ${label}`, exact: true })
      await card.getByRole('checkbox', { name: 'Обязательное поле', exact: true }).check()
      await card.getByRole('checkbox', { name: 'Показывать поле', exact: true }).uncheck()
      await expect(card.getByRole('checkbox', { name: 'Обязательное поле', exact: true })).not.toBeChecked()
      await expect(page.getByRole('region', { name: 'Предпросмотр полей формы', exact: true }).getByLabel(label, { exact: true })).toHaveCount(0)
    }
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(page.getByText('Настройки успешно сохранены', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('group', { name: 'Поле Расход воды', exact: true })
      .getByRole('textbox', { name: 'Название поля', exact: true })).toHaveValue('Расход воды')
    expect(await page.locator('main [id]').evaluateAll(elements => {
      const ids = elements.map(element => element.id)
      return ids.length === new Set(ids).size
    })).toBeTruthy()
    const configured = await (await request.get(settingsUrl, { headers })).json()
    for (const label of ['Скрытый комментарий', 'Фактический объём']) {
      expect(configured.fields.find((f: { label: string }) => f.label === label)).toMatchObject({ visible: false, required: false })
      await expect(page.getByRole('group', { name: `Поле ${label}`, exact: true }).getByRole('checkbox', { name: 'Показывать поле', exact: true })).not.toBeChecked()
    }
    await page.getByRole('button', { name: 'Архив: отчёт по объекту', exact: true }).click()
    await expect(page.getByRole('note')).toContainText('только просмотр')
    await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Настроить действующую форму', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled()
    const litersId = configured.fields.find((f: { label: string }) => f.label === 'Расход воды').id
    const checkedId = configured.fields.find((f: { label: string }) => f.label === 'Проверено').id
    expect(await (await request.get(`${api}/form-settings?form=work_form`, { headers })).json()).toEqual(legacyWork)
    expect(await (await request.get(`${api}/form-settings?form=checkout_form`, { headers })).json()).toEqual(legacyCheckout)
    await page.screenshot({ path: testInfo.outputPath('configured-day-form.png'), fullPage: true })
    const worker = await create('/users', { fullName: `Form Worker ${suffix}`, username: `form-${suffix}`, password: 'browser-worker-password', role: 'WORKER' })
    const object = await create('/objects', { name: `Form object ${suffix}` })
    const section = await create('/sections', { objectId: object.id, name: `Form section ${suffix}`, latitude: 51.2301, longitude: 51.3701, radiusMeters: 150 })
    const workType = await create('/work-types', { name: `Form type ${suffix}` })
    await create('/tasks', { sectionId: section.id, workTypeId: workType.id, assigneeUserId: worker.id,
      dueDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Oral', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), description: `Настраиваемая задача ${suffix}` })
    await page.getByRole('button', { name: 'Выйти', exact: true }).click()
    await login(page, worker.username, 'browser-worker-password')
    await page.goto(`/field/scan/${section.code}`)
    await evidence(page)
    await page.getByRole('button', { name: 'Начать рабочий день', exact: true }).click()
    await expect(page.getByText('Рабочий день открыт по серверному времени', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Фактический объём', { exact: true })).toHaveCount(0)
    await expect(page.getByLabel('Скрытый комментарий', { exact: true })).toHaveCount(0)
    await evidence(page)
    await page.getByRole('slider').focus()
    await page.getByRole('slider').press('End')
    await page.getByRole('textbox', { name: 'Что выполнено', exact: true }).fill('Работа выполнена')
    await page.getByRole('button', { name: 'Завершить рабочий день', exact: true }).click()
    await expect(page.getByText('заполните «Расход воды»', { exact: false })).toBeVisible()
    await page.getByRole('spinbutton', { name: 'Расход воды', exact: true }).fill('0')
    await page.getByRole('combobox', { name: 'Проверено', exact: true }).selectOption('false')
    await page.screenshot({ path: testInfo.outputPath('worker-configured-results.png'), fullPage: true })
    const payloads: unknown[] = []
    await page.route('**/api/field/work-days/close', async route => {
      payloads.push(route.request().postDataJSON())
      if (payloads.length === 1) {
        expect((await route.fetch()).status()).toBe(201)
        await route.abort('failed')
      } else await route.continue()
    })
    await page.getByRole('button', { name: 'Завершить рабочий день', exact: true }).click()
    await page.getByRole('button', { name: 'Повторить отправку', exact: true }).click()
    await expect(page.getByText('Рабочий день завершён', { exact: true })).toBeVisible()
    expect(payloads).toHaveLength(2)
    expect(payloads[1]).toEqual(payloads[0])
    const days = await (await request.get(`${api}/field/work-days`, { headers })).json()
    const day = days.find((row: { userId: number }) => row.userId === worker.id)
    expect(day.taskResults[0].extra).toEqual({ [litersId]: '0', [checkedId]: 'false' })
    // Removing the field from future forms cannot erase labels from a saved report.
    expect((await request.put(settingsUrl, { headers, data: original })).ok()).toBeTruthy()
    await page.getByRole('button', { name: 'Выйти', exact: true }).click()
    await login(page, adminName, adminPassword)
    await page.goto('/admin/work-days')
    const article = page.locator('article').filter({ hasText: worker.fullName })
    await expect(article.getByText('Расход воды: 0', { exact: true })).toBeVisible()
    await expect(article.getByText('Проверено: Нет', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await article.getByRole('button', { name: 'Подтвердить', exact: true }).click({ timeout: 15_000 })
    await expect(article.getByText('REVIEWED', { exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('reviewed-configured-day.png'), fullPage: true })
  } finally {
    expect((await request.put(settingsUrl, { headers, data: original })).ok()).toBeTruthy()
  }
})
