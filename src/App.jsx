import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { TaskProvider } from './context/TaskContext.jsx'
import { ToastHost } from './components/ui.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import NewOrderPage from './pages/NewOrderPage.jsx'
import { HistoryPage, AnalyticsPage, ExportPage, UsersPage, ResidentsPage } from './pages/OtherPages.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TaskProvider>
          <ToastHost/>
          <Routes>
            <Route path="/login" element={<LoginPage/>}/>
            <Route path="/" element={<ProtectedRoute><Layout/></ProtectedRoute>}>
              <Route index          element={<DashboardPage/>}/>
              <Route path="new"         element={<NewOrderPage/>}/>
              <Route path="history"     element={<HistoryPage/>}/>
              <Route path="analytics"   element={<AnalyticsPage/>}/>
              <Route path="export"      element={<ExportPage/>}/>
              <Route path="users"       element={<UsersPage/>}/>
              <Route path="residents"   element={<ResidentsPage/>}/>
            </Route>
            <Route path="*" element={<Navigate to="/" replace/>}/>
          </Routes>
        </TaskProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
