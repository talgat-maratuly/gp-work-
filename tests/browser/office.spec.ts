import { test, expect, type Page, type TestInfo } from 'playwright/test'

async function readableMobileControls(page:Page,info:TestInfo){
  if(!info.project.name.startsWith('mobile'))return
  for(const label of ['Проект','Поиск по доступным записям','Показать']){
    const box=await page.getByLabel(label,{exact:true}).boundingBox()
    expect(box?.width,`${label}: readable mobile field width`).toBeGreaterThanOrEqual(280)
  }
}

test('personal code, first password, own checklist and protected department data',async({page,context,request},info)=>{
  const api='http://localhost:3002/api',suffix=`${Date.now()}-${info.project.name}`,ip=`10.92.${info.project.name.startsWith('mobile')?2:1}.1`
  await context.setExtraHTTPHeaders({'X-Forwarded-For':ip})
  const auth=await request.post(api+'/auth/login',{headers:{'X-Forwarded-For':ip},data:{username:process.env.ADMIN_USERNAME||'e2e-admin',password:process.env.ADMIN_PASSWORD||'e2e-admin-password'}});expect(auth.ok()).toBeTruthy()
  const headers={Authorization:`Bearer ${(await auth.json()).accessToken}`,'X-Forwarded-For':ip}
  const directory=await (await request.get(api+'/office-access',{headers})).json(),unit=directory.units[0]
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/admin/office-access')
  await page.getByLabel('Логин',{exact:true}).fill(process.env.ADMIN_USERNAME||'e2e-admin');await page.getByLabel('Пароль',{exact:true}).fill(process.env.ADMIN_PASSWORD||'e2e-admin-password');await page.getByRole('button',{name:'Войти',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Личные рабочие доступы',exact:true})).toBeVisible()
  const fullName='Личный исполнитель '+suffix
  await page.getByLabel('ФИО',{exact:true}).fill(fullName);await page.getByLabel('Подразделение',{exact:true}).selectOption(String(unit.id))
  await page.getByRole('button',{name:'Создать личный вход',exact:true}).click()
  const code=await page.getByTestId('personal-code').innerText(),temporary=await page.getByTestId('temporary-password').innerText()
  expect(code).toMatch(/^GP-/)
  // Hide credentials before screenshots/trace-visible work. Playwright traces are retained only on failure.
  await page.getByRole('button',{name:'Скрыть реквизиты входа',exact:true}).click()
  const employee=(await (await request.get(api+'/office-access',{headers})).json()).users.find((u:any)=>u.username===code)
  await page.getByRole('link',{name:'Рабочий кабинет →',exact:true}).click()
  await page.getByRole('button',{name:'Новый проект',exact:true}).click()
  await page.getByLabel('Название проекта',{exact:true}).fill('Личный проект '+suffix)
  await page.getByLabel('Подразделение проекта',{exact:true}).selectOption(String(unit.id))
  await page.getByRole('checkbox',{name:fullName,exact:true}).check()
  await page.getByRole('button',{name:'Сохранить проект',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Новый проект',exact:true})).toHaveCount(0)
  const snapshot=await (await request.get(api+'/office/workspace',{headers})).json(),project=snapshot.projects.find((p:any)=>p.title==='Личный проект '+suffix)
  await page.getByLabel('Проект',{exact:true}).selectOption(String(project.id))
  await page.getByRole('button',{name:'Добавить запись',exact:true}).click()
  await page.getByLabel('Название / назначение',{exact:true}).fill('Подготовить инструмент '+suffix)
  await page.getByLabel('Исполнитель',{exact:true}).selectOption(String(employee.id))
  await page.getByLabel('Чек-лист: каждый шаг с новой строки',{exact:true}).fill('Проверить комплект\nПроверить исправность')
  await page.getByLabel('Кайдзен: что улучшить и как проверить результат',{exact:true}).fill('Избежать повторного выезда за инструментом')
  await page.route('**/api/office/records',r=>r.abort('failed'))
  await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Не удалось связаться')
  await expect(page.getByLabel('Название / назначение',{exact:true})).toHaveValue('Подготовить инструмент '+suffix)
  await page.unroute('**/api/office/records');await page.getByRole('button',{name:'Сохранить запись',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Подготовить инструмент '+suffix,exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Выйти',exact:true}).click()
  await page.getByLabel('Логин',{exact:true}).fill(code);await page.getByLabel('Пароль',{exact:true}).fill(temporary);await page.getByRole('button',{name:'Войти',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Установите свой пароль',exact:true})).toBeVisible()
  const ownPassword='office-browser-new-password';await page.getByLabel('Новый пароль',{exact:true}).fill(ownPassword);await page.getByLabel('Повторите новый пароль',{exact:true}).fill(ownPassword);await page.getByRole('button',{name:'Сохранить пароль',exact:true}).click()
  await page.getByLabel('Логин',{exact:true}).fill(code);await page.getByLabel('Пароль',{exact:true}).fill(ownPassword);await page.getByRole('button',{name:'Войти',exact:true}).click()
  await expect(page).toHaveURL(/\/office$/)
  await expect(page.getByRole('button',{name:'Договоры',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Учёт оплат',exact:true})).toHaveCount(0)
  await expect(page.getByText('Кайдзен — ожидаемый результат',{exact:true})).toBeVisible()
  await page.getByLabel('Проверить комплект',{exact:true}).check();await page.getByLabel('Проверить исправность',{exact:true}).check();await page.getByRole('button',{name:'Сохранить шаги',exact:true}).click()
  await page.getByLabel('Комментарий / результат',{exact:true}).fill('Комплект готов, исправность проверена');await page.getByRole('button',{name:'Передать на приёмку',exact:true}).click()
  await expect(page.getByText('На приёмке',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('На приёмке',{exact:true})).toBeVisible()
  await page.goto('/admin/users');await expect(page).toHaveURL(/\/office$/)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await readableMobileControls(page,info)
  await page.screenshot({path:info.outputPath('office-personal.png'),fullPage:true})
  await page.getByRole('link',{name:'Мой рабочий день',exact:true}).click();await expect(page.getByRole('heading',{name:'Мой рабочий день',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Табель сотрудников →',exact:true})).toHaveCount(0)
  expect(errors).toEqual([])
})

test('contract budget procurement invoice and partial payment persist in working screens',async({page,context,request},info)=>{
  test.setTimeout(180000)
  const api='http://localhost:3002/api',suffix=`${Date.now()}-${info.project.name}`,ip=`10.93.${info.project.name.startsWith('mobile')?2:1}.1`
  await context.setExtraHTTPHeaders({'X-Forwarded-For':ip})
  const auth=await request.post(api+'/auth/login',{headers:{'X-Forwarded-For':ip},data:{username:process.env.ADMIN_USERNAME||'e2e-admin',password:process.env.ADMIN_PASSWORD||'e2e-admin-password'}});expect(auth.ok()).toBeTruthy();const login=await auth.json()
  const headers={Authorization:`Bearer ${login.accessToken}`,'X-Forwarded-For':ip}
  const create=async(path:string,data:object)=>{const r=await request.post(api+'/office/'+path,{headers,data:{requestId:crypto.randomUUID(),...data}});expect(r.ok(),await r.text()).toBeTruthy();return r.json()}
  const directory=await (await request.get(api+'/office-access',{headers})).json(),today=new Date(Date.now()+5*3600000).toISOString().slice(0,10)
  const project=await create('projects',{title:'Финансовый проект '+suffix,unitId:directory.units[0].id,ownerId:login.user.id,startDate:today,dueDate:today,description:'Цикл закупки',memberIds:[],unitIds:[]})
  const template=await create('templates',{title:'Договор поставки '+suffix,body:'Договор {{number}} с {{counterparty}}. {{subject}}. Цена {{amount}}. Оплата {{paymentTerms}}.',approve:true})
  await page.goto('/office?project='+project.id)
  await page.getByLabel('Логин',{exact:true}).fill(process.env.ADMIN_USERNAME||'e2e-admin');await page.getByLabel('Пароль',{exact:true}).fill(process.env.ADMIN_PASSWORD||'e2e-admin-password');await page.getByRole('button',{name:'Войти',exact:true}).click()
  await expect(page.getByRole('button',{name:'Выйти',exact:true})).toBeVisible()
  // Legacy administrators retain their home; direct office navigation is explicit.
  await page.goto('/office?project='+project.id)
  const tab=async(label:string)=>{await page.getByRole('button',{name:label,exact:true}).click()}
  const add=async(title:string)=>{await page.getByRole('button',{name:'Добавить запись',exact:true}).click();await page.getByLabel('Название / назначение',{exact:true}).fill(title)}
  const save=async(title:string)=>{await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible()}
  const card=(title:string)=>page.locator('article').filter({has:page.getByRole('heading',{name:title,exact:true})})
  const approve=async(title:string)=>{const c=card(title);await c.getByRole('button',{name:'На согласование',exact:true}).click();await c.getByLabel('Комментарий / результат',{exact:true}).fill('Проверено руководителем по документам');await c.getByRole('button',{name:'Согласовать',exact:true}).click();await expect(c).toContainText('Согласовано')}
  await tab('Договоры');await add('Поставка '+suffix)
  await page.getByLabel('Утверждённый шаблон',{exact:true}).selectOption(String(template.id));await page.getByLabel('Контрагент',{exact:true}).fill('Поставщик '+suffix);await page.getByLabel('Реквизиты сторон',{exact:true}).fill('Реквизиты компании и поставщика');await page.getByLabel('Предмет договора',{exact:true}).fill('Материалы для проекта');await page.getByLabel('Сумма договора, KZT',{exact:true}).fill('100.00');await page.getByLabel('Условия оплаты',{exact:true}).fill('После приёмки');await save('Поставка '+suffix)
  await card('Поставка '+suffix).locator('input[type=file]').setInputFiles({name:'signed.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nSigned test document')})
  await expect(card('Поставка '+suffix).getByRole('button',{name:'signed.pdf',exact:true})).toBeVisible()
  await card('Поставка '+suffix).getByRole('button',{name:'На согласование',exact:true}).click();await card('Поставка '+suffix).getByLabel('Комментарий / результат',{exact:true}).fill('Подписанный экземпляр получен');await card('Поставка '+suffix).getByRole('button',{name:'Зарегистрировать подписание',exact:true}).click();await expect(card('Поставка '+suffix)).toContainText('Подписан')
  const snapshot=await (await request.get(api+'/office/workspace?projectId='+project.id,{headers})).json(),contract=snapshot.records.find((r:any)=>r.kind==='CONTRACT')
  await tab('Бюджеты');await add('Бюджет '+suffix);await page.getByLabel('Статья 1',{exact:true}).fill('Материалы');await page.getByLabel('Сумма, KZT',{exact:true}).fill('100.00');await save('Бюджет '+suffix);await approve('Бюджет '+suffix)
  await tab('Закупки');await add('Материалы '+suffix);await page.getByLabel('Подписанный договор поставщика',{exact:true}).selectOption(String(contract.id));await page.getByLabel('План закупки, KZT',{exact:true}).fill('70.00');await page.getByLabel('Что закупаем и для чего',{exact:true}).fill('Для выполнения проекта');await save('Материалы '+suffix);await approve('Материалы '+suffix)
  const purchase=(await (await request.get(api+'/office/workspace?projectId='+project.id,{headers})).json()).records.find((r:any)=>r.kind==='PURCHASE')
  await tab('Приёмка закупок');await add('Приёмка '+suffix);await page.getByLabel('Согласованная закупка',{exact:true}).selectOption(String(purchase.id));await page.getByLabel('Фактически принято, KZT',{exact:true}).fill('70.00');await page.getByLabel('Что принято, состояние и подтверждение',{exact:true}).fill('Принято без замечаний');await save('Приёмка '+suffix)
  await tab('Счета и календарь');await add('Счёт '+suffix);await page.getByLabel('Подписанный договор',{exact:true}).selectOption(String(contract.id));await page.getByLabel('Согласованная закупка',{exact:true}).selectOption(String(purchase.id));await page.getByLabel('Номер счёта поставщика',{exact:true}).fill('S-'+suffix);await page.getByLabel('Сумма счёта, KZT',{exact:true}).fill('70.00');await page.getByLabel('Реквизиты для оплаты',{exact:true}).fill('Реквизиты поставщика');await save('Счёт '+suffix);await approve('Счёт '+suffix)
  const invoice=(await (await request.get(api+'/office/workspace?projectId='+project.id,{headers})).json()).records.find((r:any)=>r.kind==='INVOICE')
  await tab('Учёт оплат');await add('Оплата '+suffix);await page.getByLabel('Согласованный счёт',{exact:true}).selectOption(String(invoice.id));await page.getByLabel('Сумма подтверждённой оплаты, KZT',{exact:true}).fill('30.00');await page.getByLabel('Номер платёжного документа',{exact:true}).fill('P-'+suffix);await save('Оплата '+suffix)
  await tab('Счета и календарь');await page.reload();await expect(card('Счёт '+suffix)).toContainText('Остаток 40');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await readableMobileControls(page,info)
  await page.screenshot({path:info.outputPath('office-finance.png'),fullPage:true})
})
