import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AccountControls } from '@/components/AccountControls'
export function AccessHomePage() {
  const {user,refresh}=useAuth()
  return <main className="mx-auto max-w-3xl space-y-5 p-4"><AccountControls/><h1 className="text-2xl font-bold">Мой кабинет</h1><p>{user?.roleName}</p><p className="text-slate-600">Доступные разделы настроены администратором.</p><div className="grid gap-3 sm:grid-cols-2">{user?.pages?.map(path=><Link key={path} to={path} className="break-words rounded border bg-white p-3 text-blue-700">{user.pageNames?.[path]??path}</Link>)}</div>{!user?.pages?.length&&<p>Разделы пока не назначены. Обратитесь к администратору.</p>}<button className="rounded border p-2" onClick={()=>void refresh()}>Обновить права доступа</button></main>
}
