import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { HomeRedirect } from '@/components/HomeRedirect'

// Страницы грузятся лениво (по мере перехода) — это ускоряет первую загрузку,
// особенно для работников в поле. Тяжёлые библиотеки (карта, QR, экспорт)
// подтягиваются только на своих экранах.
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ExportPage = lazy(() => import('@/pages/admin/ExportPage').then((m) => ({ default: m.ExportPage })))
const JournalPage = lazy(() => import('@/pages/admin/JournalPage').then((m) => ({ default: m.JournalPage })))
const WorkMapPage = lazy(() => import('@/pages/admin/WorkMapPage').then((m) => ({ default: m.WorkMapPage })))
const ObjectsPage = lazy(() => import('@/pages/admin/ObjectsPage').then((m) => ({ default: m.ObjectsPage })))
const PhotosPage = lazy(() => import('@/pages/admin/PhotosPage').then((m) => ({ default: m.PhotosPage })))
const QrPage = lazy(() => import('@/pages/admin/QrPage').then((m) => ({ default: m.QrPage })))
const WorkTypesPage = lazy(() => import('@/pages/admin/WorkTypesPage').then((m) => ({ default: m.WorkTypesPage })))
const WorkFormPage = lazy(() => import('@/pages/WorkFormPage').then((m) => ({ default: m.WorkFormPage })))
const CheckOutPage = lazy(() => import('@/pages/CheckOutPage').then((m) => ({ default: m.CheckOutPage })))
const FormSettingsPage = lazy(() => import('@/pages/admin/FormSettingsPage').then((m) => ({ default: m.FormSettingsPage })))
const SeedPage = lazy(() => import('@/pages/admin/SeedPage').then((m) => ({ default: m.SeedPage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const UsersPage = lazy(() => import('@/pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })))
const BrigadesPage = lazy(() => import('@/pages/admin/BrigadesPage').then((m) => ({ default: m.BrigadesPage })))
const TasksPage = lazy(() => import('@/pages/admin/TasksPage').then((m) => ({ default: m.TasksPage })))
const MyTasksPage = lazy(() => import('@/pages/MyTasksPage').then((m) => ({ default: m.MyTasksPage })))
const AttendancePage = lazy(() => import('@/pages/admin/AttendancePage').then((m) => ({ default: m.AttendancePage })))
const WarehousePage = lazy(() => import('@/pages/admin/WarehousePage').then((m) => ({ default: m.WarehousePage })))
const ProductImportPage = lazy(() => import('@/pages/admin/ProductImportPage').then((m) => ({ default: m.ProductImportPage })))
const AdminAiAssistantPage = lazy(() => import('@/pages/admin/AdminAiAssistantPage').then((m) => ({ default: m.AdminAiAssistantPage })))
const WateringPage = lazy(() => import('@/pages/admin/WateringPage').then((m) => ({ default: m.WateringPage })))
const AdminReportsPage = lazy(() => import('@/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })))
const ProductionSchedulePage = lazy(() => import('@/pages/admin/ProductionSchedulePage').then((m) => ({ default: m.ProductionSchedulePage })))
const ManagementPage = lazy(() => import('@/pages/admin/ManagementPage').then((m) => ({ default: m.ManagementPage })))
const WorkerLayout = lazy(() => import('@/pages/worker/WorkerLayout').then((m) => ({ default: m.WorkerLayout })))
const FieldLayout = lazy(() => import('@/layouts/FieldLayout').then((m) => ({ default: m.FieldLayout })))
const FieldTodayPage = lazy(() => import('@/pages/field/FieldTodayPage').then((m) => ({ default: m.FieldTodayPage })))
const FieldRoutePage = lazy(() => import('@/pages/field/FieldRoutePage').then((m) => ({ default: m.FieldRoutePage })))
const FieldQrPage = lazy(() => import('@/pages/field/FieldQrPage').then((m) => ({ default: m.FieldQrPage })))
const FieldTasksPage = lazy(() => import('@/pages/field/FieldTasksPage').then((m) => ({ default: m.FieldTasksPage })))
const FieldTaskPage = lazy(() => import('@/pages/field/FieldTaskPage').then((m) => ({ default: m.FieldTaskPage })))
const FieldExecutionPage = lazy(() => import('@/pages/field/FieldExecutionPage').then((m) => ({ default: m.FieldExecutionPage })))
const FieldMorePage = lazy(() => import('@/pages/field/FieldMorePage').then((m) => ({ default: m.FieldMorePage })))
const RoutesPage = lazy(() => import('@/pages/admin/RoutesPage').then((m) => ({ default: m.RoutesPage })))
const ExecutionReviewPage = lazy(() => import('@/pages/admin/ExecutionReviewPage').then((m) => ({ default: m.ExecutionReviewPage })))

function PageFallback() {
  return <div className="flex min-h-screen items-center justify-center text-slate-500">Загрузка…</div>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/work-form/:sectionCode" element={<WorkFormPage />} />
            <Route path="/work-form" element={<WorkFormPage />} />
            <Route path="/attendance/check-out" element={<CheckOutPage />} />
            <Route
              path="/field"
              element={
                <ProtectedRoute roles={['WORKER', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER']}>
                  <FieldLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/field/today" replace />} />
              <Route path="today" element={<FieldTodayPage />} />
              <Route path="route" element={<FieldRoutePage />} />
              <Route path="qr" element={<FieldQrPage />} />
              <Route path="tasks" element={<FieldTasksPage />} />
              <Route path="tasks/:taskId" element={<FieldTaskPage />} />
              <Route path="executions/:id" element={<FieldExecutionPage />} />
              <Route path="more" element={<FieldMorePage />} />
            </Route>
            <Route
              path="/worker"
              element={
                <ProtectedRoute roles={['WORKER']}>
                  <WorkerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/field/today" replace />} />
              <Route path="tasks" element={<Navigate to="/field/tasks" replace />} />
            </Route>
            <Route
              path="/admin"
              element={
                <ProtectedRoute
                  roles={['DIRECTOR', 'ADMIN', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER', 'AKIMAT', 'ANTICOR']}
                >
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="work-logs" element={<JournalPage />} />
              <Route path="map" element={<WorkMapPage />} />
              <Route path="journal" element={<Navigate to="/admin/work-logs" replace />} />
              <Route path="work-map" element={<Navigate to="/admin/map" replace />} />
              <Route path="objects" element={<ObjectsPage />} />
              <Route path="work-types" element={<WorkTypesPage />} />
              <Route path="qr" element={<QrPage />} />
              <Route path="form-settings" element={<FormSettingsPage />} />
              <Route path="export" element={<ExportPage />} />
              <Route path="photos" element={<PhotosPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="brigades" element={<BrigadesPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="routes" element={<RoutesPage />} />
              <Route path="executions" element={<ExecutionReviewPage />} />
              <Route path="watering" element={<WateringPage />} />
              <Route path="schedule" element={<ProductionSchedulePage />} />
              <Route path="management" element={<ManagementPage />} />
              <Route
                path="daily-reports"
                element={
                  <ProtectedRoute roles={['DIRECTOR', 'ADMIN', 'AKIMAT', 'ANTICOR']}>
                    <AdminReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="my-tasks"
                element={
                  <ProtectedRoute roles={['BRIGADIER', 'AGRONOMIST']}>
                    <MyTasksPage />
                  </ProtectedRoute>
                }
              />
              <Route path="attendance" element={<AttendancePage />} />
              <Route
                path="warehouse"
                element={
                  <ProtectedRoute roles={['DIRECTOR', 'ADMIN', 'BRIGADIER']}>
                    <WarehousePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="warehouse/issue"
                element={
                  <ProtectedRoute roles={['DIRECTOR', 'ADMIN', 'BRIGADIER']}>
                    <WarehousePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="warehouse/export"
                element={
                  <ProtectedRoute roles={['DIRECTOR', 'ADMIN']}>
                    <WarehousePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="products/import"
                element={
                  <ProtectedRoute roles={['DIRECTOR', 'ADMIN']}>
                    <ProductImportPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="ai-assistant"
                element={
                  <ProtectedRoute roles={['DIRECTOR', 'ADMIN']}>
                    <AdminAiAssistantPage />
                  </ProtectedRoute>
                }
              />
              <Route path="seed" element={<SeedPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
