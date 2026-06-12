import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-300">
      <Navbar />
      <main className="flex-1 w-full px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
