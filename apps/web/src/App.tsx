import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { ExportPage } from '@/pages/admin/ExportPage'
import { JournalPage } from '@/pages/admin/JournalPage'
import { WorkMapPage } from '@/pages/admin/WorkMapPage'
import { ObjectsPage } from '@/pages/admin/ObjectsPage'
import { PhotosPage } from '@/pages/admin/PhotosPage'
import { QrPage } from '@/pages/admin/QrPage'
import { WorkTypesPage } from '@/pages/admin/WorkTypesPage'
import { WorkFormPage } from '@/pages/WorkFormPage'
import { CheckOutPage } from '@/pages/CheckOutPage'
import { FormSettingsPage } from '@/pages/admin/FormSettingsPage'
import { SeedPage } from '@/pages/admin/SeedPage'
import { LoginPage } from '@/pages/LoginPage'
import { UsersPage } from '@/pages/admin/UsersPage'
import { BrigadesPage } from '@/pages/admin/BrigadesPage'
import { TasksPage } from '@/pages/admin/TasksPage'
import { MyTasksPage } from '@/pages/MyTasksPage'
import { AttendancePage } from '@/pages/admin/AttendancePage'
import { WarehousePage } from '@/pages/admin/WarehousePage'
import { ProductImportPage } from '@/pages/admin/ProductImportPage'
import { AiAgronomPage } from '@/pages/admin/AiAgronomPage'
import { AdminAiAssistantPage } from '@/pages/admin/AdminAiAssistantPage'
import { WorkerLayout } from '@/pages/worker/WorkerLayout'
import { WorkerTasksPage } from '@/pages/worker/WorkerTasksPage'
import { HomeRedirect } from '@/components/HomeRedirect'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/work-form/:sectionCode" element={<WorkFormPage />} />
          <Route path="/work-form" element={<WorkFormPage />} />
          <Route path="/attendance/check-out" element={<CheckOutPage />} />
          <Route
            path="/worker"
            element={
              <ProtectedRoute roles={['WORKER']}>
                <WorkerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/worker/tasks" replace />} />
            <Route path="tasks" element={<WorkerTasksPage />} />
          </Route>
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['ADMIN', 'BRIGADIER', 'AGRONOMIST']}>
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
                <ProtectedRoute roles={['ADMIN', 'BRIGADIER']}>
                  <WarehousePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/issue"
              element={
                <ProtectedRoute roles={['ADMIN', 'BRIGADIER']}>
                  <WarehousePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="warehouse/export"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <WarehousePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="products/import"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <ProductImportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai-agronom"
              element={
                <ProtectedRoute roles={['ADMIN', 'AGRONOMIST']}>
                  <AiAgronomPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai-assistant"
              element={
                <ProtectedRoute roles={['ADMIN']}>
                  <AdminAiAssistantPage />
                </ProtectedRoute>
              }
            />
            <Route path="seed" element={<SeedPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
