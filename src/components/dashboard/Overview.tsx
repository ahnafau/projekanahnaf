'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { TrendingUp, Store, Package, Calendar, DollarSign, Eye } from 'lucide-react'
import AddVisitModal from './AddVisitModal'
import DailyRecap from './DailyRecap'

interface OverviewProps {
  user: User
  userRole: string
}

export default function Overview({ user, userRole }: OverviewProps) {
  const [stats, setStats] = useState({
    totalCall: 0,
    totalEC: 0,
    mslAchievement: 0,
    monthlySales: 0
  })
  const [loading, setLoading] = useState(true)
  const [showAddVisit, setShowAddVisit] = useState(false)
  const [showDailyRecap, setShowDailyRecap] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchDashboardStats()
  }, [user.id, userRole])

  const fetchDashboardStats = async () => {
    setLoading(true)
    try {
      // Get today's visits (Total Call)
      let visitsQuery = supabase
        .from('visits')
        .select('id, has_order')
        .eq('visit_date', today)

      if (userRole !== 'admin') {
        visitsQuery = visitsQuery.eq('salesman_id', user.id)
      }

      const { data: visitsData } = await visitsQuery
      const totalCall = visitsData?.length || 0
      const totalEC = visitsData?.filter(v => v.has_order).length || 0

      // Calculate MSL Achievement
      let mslAchievement = 0
      
      // Get all MSL items grouped by category
      const { data: mslData } = await supabase
        .from('msl_items')
        .select('category, sku_code')
      
      const mslByCategory = (mslData || []).reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = new Set()
        acc[item.category].add(item.sku_code)
        return acc
      }, {} as Record<string, Set<string>>)

      if (Object.keys(mslByCategory).length > 0) {
        // Get stores with their categories
        let storesQuery = supabase
          .from('stores')
          .select('id, category')
        
        if (userRole !== 'admin') {
          storesQuery = storesQuery.eq('created_by', user.id)
        }
        
        const { data: storesData } = await storesQuery
        
        if (storesData && storesData.length > 0) {
          let totalAchievement = 0
          let storeCount = 0
          
          for (const store of storesData) {
            const categoryMSL = mslByCategory[store.category]
            if (!categoryMSL || categoryMSL.size === 0) continue
            
            // Get unique SKUs bought by this store today
            let ordersQuery = supabase
              .from('visits')
              .select(`
                visit_orders!inner(
                  products!inner(sku_code)
                )
              `)
              .eq('store_id', store.id)
              .eq('visit_date', today)
              .eq('has_order', true)
            
            if (userRole !== 'admin') {
              ordersQuery = ordersQuery.eq('salesman_id', user.id)
            }
            
            const { data: ordersData } = await ordersQuery
            
            const boughtSkus = new Set<string>()
            ordersData?.forEach(visit => {
              visit.visit_orders?.forEach(order => {
                if (order.products?.sku_code) {
                  boughtSkus.add(order.products.sku_code)
                }
              })
            })
            
            // Calculate achievement for this store
            const mslSkusBought = Array.from(boughtSkus).filter(sku => categoryMSL.has(sku)).length
            const storeAchievement = (mslSkusBought / categoryMSL.size) * 100
            
            totalAchievement += storeAchievement
            storeCount++
          }
          
          mslAchievement = storeCount > 0 ? totalAchievement / storeCount : 0
        }
      }

      // Get monthly sales (current month)
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format
      let monthlySalesQuery = supabase
        .from('visits')
        .select(`
          visit_orders(line_total)
        `)
        .gte('visit_date', `${currentMonth}-01`)
        .lte('visit_date', `${currentMonth}-31`)

      if (userRole !== 'admin') {
        monthlySalesQuery = monthlySalesQuery.eq('salesman_id', user.id)
      }

      const { data: salesData } = await monthlySalesQuery
      const monthlySales = salesData?.reduce((total, visit) => {
        return total + (visit.visit_orders?.reduce((sum, order) => sum + order.line_total, 0) || 0)
      }, 0) || 0

      setStats({
        totalCall,
        totalEC,
        mslAchievement,
        monthlySales
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      // Set default values on error
      setStats({
        totalCall: 0,
        totalEC: 0,
        mslAchievement: 0,
        monthlySales: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVisitSuccess = () => {
    fetchDashboardStats() // Refresh stats after adding visit
  }

  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long' })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user.email?.split('@')[0]}!
            </h1>
            <p className="text-gray-600 mt-1">
              Here's your daily performance summary.
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Call</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : stats.totalCall}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Store className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500">Kunjungan hari ini</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total EC</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : stats.totalEC}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500">
              Effective Call ({stats.totalCall > 0 ? Math.round((stats.totalEC / stats.totalCall) * 100) : 0}%)
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">MSL Achievement</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : `${stats.mslAchievement.toFixed(1)}%`}
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500">Rata-rata pencapaian MSL hari ini</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales [{currentMonth}]</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {loading ? '...' : `Rp ${stats.monthlySales.toLocaleString('id-ID')}`}
              </p>
            </div>
            <div className="h-12 w-12 bg-orange-50 rounded-lg flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500">Penjualan bulan ini</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={() => setShowAddVisit(true)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Tambah Kunjungan Toko</p>
                  <p className="text-sm text-gray-500">Catat kunjungan dan pesanan hari ini</p>
                </div>
              </div>
            </button>
            
            <button 
              onClick={() => setShowDailyRecap(true)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Eye className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Lihat Rekap Harian</p>
                  <p className="text-sm text-gray-500">Detail kunjungan dan penjualan hari ini</p>
                </div>
              </div>
            </button>
            
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Package className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">View Products</p>
                  <p className="text-sm text-gray-500">Browse product catalog</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="h-2 w-2 bg-green-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Store visit completed</p>
                <p className="text-xs text-gray-500">Beauty Corner - 2 hours ago</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="h-2 w-2 bg-blue-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">New order placed</p>
                <p className="text-xs text-gray-500">Glamour Boutique - 4 hours ago</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="h-2 w-2 bg-orange-500 rounded-full mt-2"></div>
              <div>
                <p className="text-sm font-medium text-gray-900">Product updated</p>
                <p className="text-xs text-gray-500">L'Oréal Paris Mascara - Yesterday</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddVisit && (
        <AddVisitModal
          user={user}
          onClose={() => setShowAddVisit(false)}
          onSuccess={handleVisitSuccess}
        />
      )}

      {showDailyRecap && (
        <DailyRecap
          user={user}
          userRole={userRole}
          selectedDate={today}
          onClose={() => setShowDailyRecap(false)}
        />
      )}
    </div>
  )
}