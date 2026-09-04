import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { HomeRedirect } from '@/components/HomeRedirect'
import { ADMIN_ROUTE_ROLES } from '@/lib/rolePermissions'
import type { UserRole } from '@/lib/auth'

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
const LegacyWorkFormRedirect = lazy(() => import('@/pages/LegacyWorkFormRedirect').then((m) => ({ default: m.LegacyWorkFormRedirect })))
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
const FieldScanPage = lazy(() => import('@/pages/field/FieldScanPage').then((m) => ({ default: m.FieldScanPage })))
const FieldTasksPage = lazy(() => import('@/pages/field/FieldTasksPage').then((m) => ({ default: m.FieldTasksPage })))
const FieldTaskPage = lazy(() => import('@/pages/field/FieldTaskPage').then((m) => ({ default: m.FieldTaskPage })))
const FieldExecutionPage = lazy(() => import('@/pages/field/FieldExecutionPage').then((m) => ({ default: m.FieldExecutionPage })))
const FieldMorePage = lazy(() => import('@/pages/field/FieldMorePage').then((m) => ({ default: m.FieldMorePage })))
const FieldAiAssistantPage = lazy(() => import('@/pages/field/FieldAiAssistantPage').then((m) => ({ default: m.FieldAiAssistantPage })))
const RoutesPage = lazy(() => import('@/pages/admin/RoutesPage').then((m) => ({ default: m.RoutesPage })))
const ExecutionReviewPage = lazy(() => import('@/pages/admin/ExecutionReviewPage').then((m) => ({ default: m.ExecutionReviewPage })))
const VehiclesPage = lazy(() => import('@/pages/admin/VehiclesPage').then((m) => ({ default: m.VehiclesPage })))
const NurseryPage = lazy(() => import('@/pages/admin/NurseryPage').then((m) => ({ default: m.NurseryPage })))
const DispatcherPage = lazy(() => import('@/pages/admin/DispatcherPage').then((m) => ({ default: m.DispatcherPage })))
const KpiPage = lazy(() => import('@/pages/admin/KpiPage').then((m) => ({ default: m.KpiPage })))
const EvidenceReportsPage = lazy(() => import('@/pages/admin/EvidenceReportsPage').then((m) => ({ default: m.EvidenceReportsPage })))
const WorkDaysPage = lazy(() => import('@/pages/admin/WorkDaysPage').then((m) => ({ default: m.WorkDaysPage })))

function PageFallback() {
  return <div className="flex min-h-screen items-center justify-center text-slate-500">Загрузка…</div>
}

function forRoles(page: ReactNode, roles: readonly UserRole[]) {
  return <ProtectedRoute roles={roles}>{page}</ProtectedRoute>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/work-form/:sectionCode" element={forRoles(<LegacyWorkFormRedirect />, ['WORKER', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER'])} />
            <Route path="/work-form" element={forRoles(<LegacyWorkFormRedirect />, ['WORKER', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER'])} />
            <Route path="/attendance/check-out" element={<CheckOutPage />} />
            <Route path="/field/scan/:sectionCode" element={<ProtectedRoute roles={['WORKER', 'BRIGADIER', 'AGRONOMIST', 'WATER_CARRIER']}><FieldScanPage /></ProtectedRoute>} />
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
              <Route path="assistant" element={<FieldAiAssistantPage />} />
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
              <Route index element={forRoles(<DashboardPage />, ADMIN_ROUTE_ROLES.dashboard)} />
              <Route path="work-logs" element={forRoles(<JournalPage />, ADMIN_ROUTE_ROLES.workLogs)} />
              <Route path="map" element={forRoles(<WorkMapPage />, ADMIN_ROUTE_ROLES.map)} />
              <Route path="journal" element={<Navigate to="/admin/work-logs" replace />} />
              <Route path="work-map" element={<Navigate to="/admin/map" replace />} />
              <Route path="objects" element={forRoles(<ObjectsPage />, ADMIN_ROUTE_ROLES.objects)} />
              <Route path="work-types" element={forRoles(<WorkTypesPage />, ADMIN_ROUTE_ROLES.workTypes)} />
              <Route path="qr" element={forRoles(<QrPage />, ADMIN_ROUTE_ROLES.qr)} />
              <Route path="form-settings" element={forRoles(<FormSettingsPage />, ADMIN_ROUTE_ROLES.formSettings)} />
              <Route path="export" element={forRoles(<ExportPage />, ADMIN_ROUTE_ROLES.export)} />
              <Route path="photos" element={forRoles(<PhotosPage />, ADMIN_ROUTE_ROLES.photos)} />
              <Route path="users" element={forRoles(<UsersPage />, ADMIN_ROUTE_ROLES.users)} />
              <Route path="brigades" element={forRoles(<BrigadesPage />, ADMIN_ROUTE_ROLES.brigades)} />
              <Route path="tasks" element={forRoles(<TasksPage />, ADMIN_ROUTE_ROLES.tasks)} />
              <Route path="routes" element={forRoles(<RoutesPage />, ADMIN_ROUTE_ROLES.routes)} />
              <Route path="executions" element={forRoles(<ExecutionReviewPage />, ADMIN_ROUTE_ROLES.executions)} />
              <Route path="dispatcher" element={forRoles(<DispatcherPage />, ADMIN_ROUTE_ROLES.dispatcher)} />
              <Route path="kpi" element={forRoles(<KpiPage />, ADMIN_ROUTE_ROLES.kpi)} />
              <Route path="evidence-reports" element={forRoles(<EvidenceReportsPage />, ADMIN_ROUTE_ROLES.evidenceReports)} />
              <Route
                path="vehicles"
                element={
                  forRoles(<VehiclesPage />, ADMIN_ROUTE_ROLES.vehicles)
                }
              />
              <Route
                path="nursery"
                element={
                  forRoles(<NurseryPage />, ADMIN_ROUTE_ROLES.nursery)
                }
              />
              <Route path="watering" element={forRoles(<WateringPage />, ADMIN_ROUTE_ROLES.watering)} />
              <Route path="schedule" element={forRoles(<ProductionSchedulePage />, ADMIN_ROUTE_ROLES.schedule)} />
              <Route path="management" element={forRoles(<ManagementPage />, ADMIN_ROUTE_ROLES.management)} />
              <Route
                path="daily-reports"
                element={
                  forRoles(<AdminReportsPage />, ADMIN_ROUTE_ROLES.dailyReports)
                }
              />
              <Route
                path="my-tasks"
                element={
                  forRoles(<MyTasksPage />, ADMIN_ROUTE_ROLES.myTasks)
                }
              />
              <Route path="attendance" element={forRoles(<AttendancePage />, ADMIN_ROUTE_ROLES.attendance)} />
              <Route path="work-days" element={forRoles(<WorkDaysPage />, ADMIN_ROUTE_ROLES.workDays)} />
              <Route
                path="warehouse"
                element={
                  forRoles(<WarehousePage />, ADMIN_ROUTE_ROLES.warehouse)
                }
              />
              <Route
                path="warehouse/issue"
                element={
                  forRoles(<WarehousePage />, ADMIN_ROUTE_ROLES.warehouse)
                }
              />
              <Route
                path="warehouse/export"
                element={
                  forRoles(<WarehousePage />, ADMIN_ROUTE_ROLES.warehouseExport)
                }
              />
              <Route
                path="products/import"
                element={
                  forRoles(<ProductImportPage />, ADMIN_ROUTE_ROLES.productImport)
                }
              />
              <Route
                path="ai-assistant"
                element={
                  forRoles(<AdminAiAssistantPage />, ADMIN_ROUTE_ROLES.aiAssistant)
                }
              />
              <Route path="seed" element={forRoles(<SeedPage />, ADMIN_ROUTE_ROLES.seed)} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
