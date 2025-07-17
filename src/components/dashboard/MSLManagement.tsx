'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { 
  List, 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  X,
  GripVertical,
  Store,
  Package
} from 'lucide-react'
import MSLCsvUpload from './MSLCsvUpload'

interface MSLManagementProps {
  user: User
  userRole: string
}

interface MSLItem {
  id: string
  category: string
  sku_code: string
  product_name: string
  priority: number
  notes: string | null
}

interface CategoryStats {
  category: string
  itemCount: number
  storeCount: number
}

export default function MSLManagement({ user, userRole }: MSLManagementProps) {
  const [mslItems, setMslItems] = useState<MSLItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([])
  const [activeTab, setActiveTab] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCsvUpload, setShowCsvUpload] = useState(false)
  const [draggedItem, setDraggedItem] = useState<MSLItem | null>(null)

  useEffect(() => {
    fetchMSLData()
    fetchCategoryStats()
    
    // Listen for category change events from store directory
    const handleCategoryChange = (event: CustomEvent) => {
      setActiveTab(event.detail)
    }
    
    window.addEventListener('setMSLCategory', handleCategoryChange as EventListener)
    
    return () => {
      window.removeEventListener('setMSLCategory', handleCategoryChange as EventListener)
    }
  }, [])

  const fetchMSLData = async () => {
    try {
      const { data, error } = await supabase
        .from('msl_items')
        .select('*')
        .order('category')
        .order('priority')

      if (error) throw error

      setMslItems(data || [])
      
      // Extract unique categories
      const uniqueCategories = [...new Set((data || []).map(item => item.category))]
      setCategories(uniqueCategories)
      
      // Set first category as active tab
      if (uniqueCategories.length > 0 && !activeTab) {
        setActiveTab(uniqueCategories[0])
      }
    } catch (error) {
      console.error('Error fetching MSL data:', error)
      setMslItems([])
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCategoryStats = async () => {
    try {
      // Get MSL item counts per category
      const { data: mslData, error: mslError } = await supabase
        .from('msl_items')
        .select('category')

      if (mslError) throw mslError

      // Get store counts per category
      const { data: storeData, error: storeError } = await supabase
        .from('stores')
        .select('category')

      if (storeError) throw storeError

      // Calculate stats
      const mslCounts = (mslData || []).reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const storeCounts = (storeData || []).reduce((acc, store) => {
        acc[store.category] = (acc[store.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Combine stats
      const allCategories = new Set([...Object.keys(mslCounts), ...Object.keys(storeCounts)])
      const stats: CategoryStats[] = Array.from(allCategories).map(category => ({
        category,
        itemCount: mslCounts[category] || 0,
        storeCount: storeCounts[category] || 0
      }))

      setCategoryStats(stats)
    } catch (error) {
      console.error('Error fetching category stats:', error)
      setCategoryStats([])
    }
  }

  const handleMSLUploadSuccess = () => {
    fetchMSLData()
    fetchCategoryStats()
  }

  const exportMSL = () => {
    const csvContent = [
      'CATEGORY,SKU_CODE,PRODUCT_NAME,PRIORITY,NOTES',
      ...mslItems.map(item => 
        `${item.category},${item.sku_code},"${item.product_name}",${item.priority},"${item.notes || ''}"`
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `msl_export_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleDragStart = (item: MSLItem) => {
    setDraggedItem(item)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetItem: MSLItem) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem.id === targetItem.id || draggedItem.category !== targetItem.category) {
      setDraggedItem(null)
      return
    }

    try {
      // Update priorities in database
      const { error } = await supabase
        .from('msl_items')
        .update({ priority: targetItem.priority })
        .eq('id', draggedItem.id)

      if (error) throw error

      const { error: error2 } = await supabase
        .from('msl_items')
        .update({ priority: draggedItem.priority })
        .eq('id', targetItem.id)

      if (error2) throw error2

      // Refresh data
      fetchMSLData()
    } catch (error) {
      console.error('Error updating priorities:', error)
    }

    setDraggedItem(null)
  }

  const getActiveTabItems = () => {
    return mslItems.filter(item => item.category === activeTab)
  }

  const getCategoryStats = (category: string) => {
    return categoryStats.find(stat => stat.category === category)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">MSL Management</h1>
          <p className="text-gray-600">Manage Must Selling List recommendations by category</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportMSL}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export MSL
          </button>
          {userRole === 'admin' && (
            <button 
              onClick={() => setShowCsvUpload(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload MSL
            </button>
          )}
        </div>
      </div>

      {/* Category Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categoryStats.map((stat) => (
          <div key={stat.category} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">{stat.category}</h3>
              <div className="flex items-center space-x-1">
                <Package className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-600">{stat.itemCount}</span>
                <Store className="h-4 w-4 text-green-600 ml-2" />
                <span className="text-sm text-green-600">{stat.storeCount}</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              {stat.itemCount} MSL items • {stat.storeCount} stores
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Category Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {categories.map((category) => {
                  const stats = getCategoryStats(category)
                  return (
                    <button
                      key={category}
                      onClick={() => setActiveTab(category)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                        activeTab === category
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {category}
                      {stats && (
                        <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                          {stats.itemCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {activeTab} MSL Items
                    </h3>
                    <div className="text-sm text-gray-500">
                      {getActiveTabItems().length} items • Drag to reorder priority
                    </div>
                  </div>

                  {getActiveTabItems().length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No MSL items for this category
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {getActiveTabItems().map((item) => (
                        <div
                          key={item.id}
                          draggable={userRole === 'admin'}
                          onDragStart={() => handleDragStart(item)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, item)}
                          className={`flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors ${
                            userRole === 'admin' ? 'cursor-move' : ''
                          } ${draggedItem?.id === item.id ? 'opacity-50' : ''}`}
                        >
                          {userRole === 'admin' && (
                            <GripVertical className="h-5 w-5 text-gray-400 mr-3" />
                          )}
                          
                          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full text-sm font-bold mr-4">
                            {item.priority}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-1">
                              <span className="font-mono text-sm text-gray-600 bg-gray-200 px-2 py-1 rounded">
                                {item.sku_code}
                              </span>
                              <h4 className="font-medium text-gray-900 truncate">
                                {item.product_name}
                              </h4>
                            </div>
                            {item.notes && (
                              <p className="text-sm text-gray-600 truncate">
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* CSV Upload Modal */}
      {showCsvUpload && (
        <MSLCsvUpload
          onClose={() => setShowCsvUpload(false)}
          onSuccess={handleMSLUploadSuccess}
        />
      )}
    </div>
  )
}