'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { 
  Home, 
  Store, 
  Package, 
  BarChart3, 
  Settings, 
  LogOut,
  Menu,
  X,
  Sparkles,
  List
} from 'lucide-react'
import Overview from './dashboard/Overview'
import Stores from './dashboard/Stores'
import Products from './dashboard/Products'
import Reports from './dashboard/Reports'
import Management from './dashboard/Management'
import MSLManagement from './dashboard/MSLManagement'

export type TabType = 'overview' | 'stores' | 'products' | 'reports' | 'msl' | 'management'

interface DashboardProps {
  user: User
}

export default function Dashboard({ user }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole, setUserRole] = useState<string>('salesman')

  useEffect(() => {
    getUserRole()
  }, [])

  const getUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching user role:', error)
      } else {
        setUserRole(data?.role || 'salesman')
      }
    } catch (error) {
      console.error('Error getting user role:', error)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const navigation = [
    { id: 'overview', name: 'Beranda', icon: Home },
    { id: 'stores', name: 'Toko', icon: Store },
    { id: 'products', name: 'Produk', icon: Package },
    { id: 'msl', name: 'MSL Management', icon: List },
    { id: 'reports', name: 'Laporan', icon: BarChart3 },
  ]

  if (userRole === 'admin') {
    navigation.push({ id: 'management', name: 'Kelola', icon: Settings })
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <Overview user={user} userRole={userRole} />
      case 'stores':
        return <Stores user={user} userRole={userRole} setActiveTab={setActiveTab} />
      case 'products':
        return <Products user={user} userRole={userRole} />
      case 'msl':
        return <MSLManagement user={user} userRole={userRole} />
      case 'reports':
        return <Reports user={user} userRole={userRole} />
      case 'management':
        return <Management user={user} userRole={userRole} />
      default:
        return <Overview user={user} userRole={userRole} />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75"></div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 bg-gradient-to-r from-loreal-orange to-loreal-red rounded-lg flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">L'Oréal</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as TabType)
                    setSidebarOpen(false)
                  }}
                  className={`
                    w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                    ${activeTab === item.id
                      ? 'bg-orange-50 text-loreal-orange border-r-2 border-loreal-orange'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </button>
              )
            })}
          </div>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-gray-200 space-y-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-700">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">{userRole}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Keluar
          </button>
          
          {/* Credit Text */}
          <div className="text-center">
            <p className="text-xs text-gray-400 opacity-75 leading-relaxed">
              Made with ♥ by Ahnaf for Salesman Stint Project.<br />
              MT Commercial CPD 2025
            </p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              <Menu className="h-6 w-6 text-gray-600" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="h-6 w-6 bg-gradient-to-r from-loreal-orange to-loreal-red rounded flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900">L'Oréal</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  )
}