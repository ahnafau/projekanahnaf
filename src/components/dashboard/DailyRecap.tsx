'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Calendar, TrendingUp, Store, Package, DollarSign, X } from 'lucide-react'

interface DailyRecapProps {
  user: User
  userRole: string
  selectedDate: string
  onClose: () => void
}

interface DailyData {
  visits: Array<{
    id: string
    store_name: string
    store_code: string
    store_category: string
    has_order: boolean
    total_amount: number
    order_items: Array<{
      sku_code: string
      product_name: string
      quantity: number
      line_total: number
    }>
  }>
  totalVisits: number
  totalEC: number
  totalSales: number
  mslAchievement: number
}

export default function DailyRecap({ user, userRole, selectedDate, onClose }: DailyRecapProps) {
  const [dailyData, setDailyData] = useState<DailyData>({
    visits: [],
    totalVisits: 0,
    totalEC: 0,
    totalSales: 0,
    mslAchievement: 0
  })
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(selectedDate)

  useEffect(() => {
    fetchDailyData()
  }, [currentDate, user.id, userRole])

  const fetchDailyData = async () => {
    setLoading(true)
    try {
      // Build query based on user role
      let visitsQuery = supabase
        .from('visits')
        .select(`
          id,
          has_order,
          stores!inner(store_name, store_code, category),
          visit_orders(
            quantity,
            line_total,
            products!inner(sku_code, product_name)
          )
        `)
        .eq('visit_date', currentDate)

      // Filter by salesman if not admin
      if (userRole !== 'admin') {
        visitsQuery = visitsQuery.eq('salesman_id', user.id)
      }

      const { data: visitsData, error: visitsError } = await visitsQuery

      if (visitsError) throw visitsError

      // Process the data
      const visits = (visitsData || []).map(visit => {
        const orderItems = visit.visit_orders?.map(order => ({
          sku_code: order.products.sku_code,
          product_name: order.products.product_name,
          quantity: order.quantity,
          line_total: order.line_total
        })) || []

        const totalAmount = orderItems.reduce((sum, item) => sum + item.line_total, 0)

        return {
          id: visit.id,
          store_name: visit.stores.store_name,
          store_code: visit.stores.store_code,
          store_category: visit.stores.category,
          has_order: visit.has_order,
          total_amount: totalAmount,
          order_items: orderItems
        }
      })

      const totalVisits = visits.length
      const totalEC = visits.filter(v => v.has_order).length
      const totalSales = visits.reduce((sum, v) => sum + v.total_amount, 0)

      // Calculate MSL Achievement for the day
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

      if (Object.keys(mslByCategory).length > 0 && visits.length > 0) {
        let totalAchievement = 0
        let storeCount = 0
        
        // Group visits by store to avoid counting same store multiple times
        const storeVisits = visits.reduce((acc, visit) => {
          const key = `${visit.store_name}-${visit.store_code}`
          if (!acc[key]) {
            acc[key] = {
              category: visit.store_category,
              orderItems: []
            }
          }
          acc[key].orderItems.push(...visit.order_items)
          return acc
        }, {} as Record<string, { category: string; orderItems: any[] }>)
        
        for (const [storeKey, storeData] of Object.entries(storeVisits)) {
          const categoryMSL = mslByCategory[storeData.category]
          if (!categoryMSL || categoryMSL.size === 0) continue
          
          // Get unique SKUs bought by this store
          const boughtSkus = new Set<string>()
          storeData.orderItems.forEach(item => {
            if (item.sku_code) {
              boughtSkus.add(item.sku_code)
            }
          })
          
          // Calculate achievement for this store
          const mslSkusBought = Array.from(boughtSkus).filter(sku => categoryMSL.has(sku)).length
          const storeAchievement = (mslSkusBought / categoryMSL.size) * 100
          
          totalAchievement += storeAchievement
          storeCount++
        }
        
        mslAchievement = storeCount > 0 ? totalAchievement / storeCount : 0
      }

      setDailyData({
        visits,
        totalVisits,
        totalEC,
        totalSales,
        mslAchievement
      })
    } catch (error) {
      console.error('Error fetching daily data:', error)
      // Reset to empty state on error
      setDailyData({
        visits: [],
        totalVisits: 0,
        totalEC: 0,
        totalSales: 0,
        mslAchievement: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Rekap Harian</h2>
              <p className="text-sm text-gray-600">{formatDate(currentDate)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Date Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Tanggal
            </label>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => setCurrentDate(e.target.value)}
              className="p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Store className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Total Call</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900 mt-1">{dailyData.totalVisits}</p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Total EC</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900 mt-1">{dailyData.totalEC}</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">EC Rate</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900 mt-1">
                    {dailyData.totalVisits > 0 ? Math.round((dailyData.totalEC / dailyData.totalVisits) * 100) : 0}%
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium text-orange-900">Total Penjualan</span>
                  </div>
                  <p className="text-2xl font-bold text-orange-900 mt-1">Rp {dailyData.totalSales.toLocaleString('id-ID')}</p>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">MSL Achievement</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900 mt-1">{dailyData.mslAchievement.toFixed(1)}%</p>
                </div>
              </div>

              {/* Visits Detail */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detail Kunjungan</h3>
                
                {dailyData.visits.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Tidak ada kunjungan pada tanggal ini
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dailyData.visits.map((visit) => (
                      <div key={visit.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{visit.store_name}</h4>
                            <p className="text-sm text-gray-600">Kode: {visit.store_code}</p>
                          </div>
                          <div className="text-right">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              visit.has_order 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {visit.has_order ? 'Ada Order' : 'Tidak Order'}
                            </span>
                            {visit.has_order && (
                              <p className="text-lg font-bold text-gray-900 mt-1">
                                Rp {visit.total_amount.toLocaleString('id-ID')}
                              </p>
                            )}
                          </div>
                        </div>

                        {visit.order_items.length > 0 && (
                          <div className="border-t border-gray-200 pt-3">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Produk yang Dibeli:</h5>
                            <div className="space-y-1">
                              {visit.order_items.map((item, index) => (
                                <div key={index} className="flex justify-between text-sm">
                                  <span className="text-gray-600">
                                    {item.sku_code} - {item.product_name} (x{item.quantity})
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    Rp {item.line_total.toLocaleString('id-ID')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}