'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { BarChart3, TrendingUp, Download, Calendar, Store } from 'lucide-react'

interface ReportsProps {
  user: User
  userRole: string
}

interface TopStore {
  store_name: string
  store_code: string
  total_orders: number
  total_amount: number
  visit_count: number
}

interface RecentSale {
  date: string
  store_name: string
  product_name: string
  sku_code: string
  quantity: number
  amount: number
}

export default function Reports({ user, userRole }: ReportsProps) {
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    storeVisits: 0,
    conversionRate: 0,
    avgOrderValue: 0
  })
  const [topStores, setTopStores] = useState<TopStore[]>([])
  const [recentSales, setRecentSales] = useState<RecentSale[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    fetchReportsData()
  }, [dateRange, user.id, userRole])

  const fetchReportsData = async () => {
    setLoading(true)
    try {
      // Build base query with user role filter
      let baseQuery = supabase
        .from('visits')
        .select(`
          id,
          visit_date,
          has_order,
          stores!inner(store_name, store_code),
          visit_orders(
            quantity,
            line_total,
            products!inner(product_name, sku_code)
          )
        `)
        .gte('visit_date', dateRange.start)
        .lte('visit_date', dateRange.end)

      if (userRole !== 'admin') {
        baseQuery = baseQuery.eq('salesman_id', user.id)
      }

      const { data: visitsData, error } = await baseQuery
      if (error) throw error

      // Calculate metrics
      const totalVisits = visitsData?.length || 0
      const visitsWithOrders = visitsData?.filter(v => v.has_order) || []
      const totalSales = visitsData?.reduce((sum, visit) => {
        return sum + (visit.visit_orders?.reduce((orderSum, order) => orderSum + order.line_total, 0) || 0)
      }, 0) || 0
      
      const conversionRate = totalVisits > 0 ? (visitsWithOrders.length / totalVisits) * 100 : 0
      const avgOrderValue = visitsWithOrders.length > 0 ? totalSales / visitsWithOrders.length : 0

      setMetrics({
        totalSales,
        storeVisits: totalVisits,
        conversionRate,
        avgOrderValue
      })

      // Calculate top stores
      const storeStats = new Map<string, {
        store_name: string
        store_code: string
        total_orders: number
        total_amount: number
        visit_count: number
      }>()

      visitsData?.forEach(visit => {
        const storeKey = visit.stores.store_code
        const existing = storeStats.get(storeKey) || {
          store_name: visit.stores.store_name,
          store_code: visit.stores.store_code,
          total_orders: 0,
          total_amount: 0,
          visit_count: 0
        }

        existing.visit_count++
        if (visit.has_order) {
          existing.total_orders++
          existing.total_amount += visit.visit_orders?.reduce((sum, order) => sum + order.line_total, 0) || 0
        }

        storeStats.set(storeKey, existing)
      })

      const topStoresArray = Array.from(storeStats.values())
        .sort((a, b) => b.total_amount - a.total_amount)
        .slice(0, 5)
      
      setTopStores(topStoresArray)

      // Prepare recent sales
      const recentSalesData: RecentSale[] = []
      visitsData?.forEach(visit => {
        visit.visit_orders?.forEach(order => {
          recentSalesData.push({
            date: visit.visit_date,
            store_name: visit.stores.store_name,
            product_name: order.products.product_name,
            sku_code: order.products.sku_code,
            quantity: order.quantity,
            amount: order.line_total
          })
        })
      })

      // Sort by date (newest first) and take top 10
      const sortedSales = recentSalesData
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
      
      setRecentSales(sortedSales)

    } catch (error) {
      console.error('Error fetching reports data:', error)
      // Reset to empty state on error
      setMetrics({
        totalSales: 0,
        storeVisits: 0,
        conversionRate: 0,
        avgOrderValue: 0
      })
      setTopStores([])
      setRecentSales([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
          <p className="text-gray-600">Track your performance and analyze trends</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Total Sales</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '...' : `Rp ${metrics.totalSales.toLocaleString('id-ID')}`}
            </p>
            <span className="text-sm text-gray-500">Period total</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Store Visits</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '...' : metrics.storeVisits}
            </p>
            <span className="text-sm text-gray-500">Total visits</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Conversion Rate</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '...' : `${metrics.conversionRate.toFixed(1)}%`}
            </p>
            <span className="text-sm text-gray-500">Visits with orders</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-600">Avg Order Value</h3>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-2">
            <p className="text-2xl font-bold text-gray-900">
              {loading ? '...' : `Rp ${metrics.avgOrderValue.toLocaleString('id-ID')}`}
            </p>
            <span className="text-sm text-gray-500">Per order</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Stores */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Stores</h3>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
            </div>
          ) : topStores.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Belum ada data penjualan
            </div>
          ) : (
            <div className="space-y-4">
              {topStores.map((store, index) => (
                <div key={store.store_code} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-900">
                      {store.store_name} ({store.store_code})
                    </span>
                    <span className="text-gray-600">Rp {store.total_amount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${topStores.length > 0 ? (store.total_amount / topStores[0].total_amount) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{store.total_orders} orders</span>
                    <span>{store.visit_count} visits</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Chart visualization coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sales Activity</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600"></div>
          </div>
        ) : recentSales.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Belum ada aktivitas penjualan
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Store</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">SKU</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Quantity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{sale.date}</td>
                    <td className="py-3 px-4 text-gray-900">{sale.store_name}</td>
                    <td className="py-3 px-4 text-gray-900">{sale.product_name}</td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-xs">{sale.sku_code}</td>
                    <td className="py-3 px-4 text-gray-900">{sale.quantity}</td>
                    <td className="py-3 px-4 font-medium text-gray-900">Rp {sale.amount.toLocaleString('id-ID')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}