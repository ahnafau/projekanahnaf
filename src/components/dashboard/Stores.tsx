'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Store, MapPin, Phone, Plus, Search, Upload, X } from 'lucide-react'
import AddStoreModal from './AddStoreModal'
import StoreCsvUpload from './StoreCsvUpload'
import { useState as useStateForMSL } from 'react'
import { TabType } from '../Dashboard'

interface StoresProps {
  user: User
  userRole: string
  setActiveTab: (tab: TabType) => void
}

interface StoreData {
  id: string
  store_name: string
  store_code: string
  address: string
  route: string
  phone: string | null
  key_contact: string | null
  average_order_value: number | null
  order_frequency: string | null
  category: string
  gmaps_link?: string | null
  notes?: string | null
}

export default function Stores({ user, userRole, setActiveTab }: StoresProps) {
  const [stores, setStores] = useState<StoreData[]>([])
  const [filteredStores, setFilteredStores] = useState<StoreData[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [routes, setRoutes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRoute, setSelectedRoute] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showAddStore, setShowAddStore] = useState(false)
  const [showCsvUpload, setShowCsvUpload] = useState(false)
  const [mslItems, setMslItems] = useState<{[category: string]: any[]}>({})
  const [editingStore, setEditingStore] = useState<StoreData | null>(null)

  useEffect(() => {
    fetchStores()
    fetchCategoriesAndRoutes()
    fetchMSLData()
  }, [])

  useEffect(() => {
    filterStores()
  }, [stores, searchTerm, selectedRoute, selectedCategory])

  const fetchStores = async () => {
    try {
      let query = supabase
        .from('stores')
        .select('*')
        .order('store_name')

      // Filter by user if not admin
      if (userRole !== 'admin') {
        query = query.eq('created_by', user.id)
      }

      const { data, error } = await query
      if (error) throw error

      setStores(data || [])
      setFilteredStores(data || [])
    } catch (error) {
      console.error('Error fetching stores:', error)
      setStores([])
      setFilteredStores([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCategoriesAndRoutes = async () => {
    try {
      let query = supabase
        .from('stores')
        .select('category, route')

      // Filter by user if not admin
      if (userRole !== 'admin') {
        query = query.eq('created_by', user.id)
      }

      const { data, error } = await query
      if (error) throw error

      // Extract unique categories and routes
      const uniqueCategories = [...new Set((data || []).map(s => s.category).filter(Boolean))]
      const uniqueRoutes = [...new Set((data || []).map(s => s.route).filter(Boolean))]
      
      setCategories(uniqueCategories.sort())
      setRoutes(uniqueRoutes.sort())
    } catch (error) {
      console.error('Error fetching categories and routes:', error)
    }
  }

  const fetchMSLData = async () => {
    try {
      const { data, error } = await supabase
        .from('msl_items')
        .select('category, sku_code, product_name, priority')
        .order('category')
        .order('priority')

      if (error) throw error

      // Group MSL items by category
      const grouped = (data || []).reduce((acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = []
        }
        acc[item.category].push(item)
        return acc
      }, {} as {[category: string]: any[]})

      setMslItems(grouped)
    } catch (error) {
      console.error('Error fetching MSL data:', error)
      setMslItems({})
    }
  }

  const filterStores = () => {
    let filtered = stores

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(store =>
        store.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.store_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        store.address.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by route
    if (selectedRoute) {
      filtered = filtered.filter(store => store.route === selectedRoute)
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(store => store.category === selectedCategory)
    }

    setFilteredStores(filtered)
  }

  const handleAddStoreSuccess = () => {
    fetchStores() // Refresh stores after adding
    fetchCategoriesAndRoutes() // Refresh categories and routes
  }

  const handleCsvUploadSuccess = () => {
    fetchStores() // Refresh stores after CSV upload
    fetchCategoriesAndRoutes() // Refresh categories and routes
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      'GT PROV': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
      'GT Wholesale': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
      'GT Small Cosmetics': { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' }
    }
    return colors[category as keyof typeof colors] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' }
  }

  const getMSLCount = (category: string) => {
    return mslItems[category]?.length || 0
  }

  const getTopMSLItems = (category: string, limit: number = 5) => {
    return mslItems[category]?.slice(0, limit) || []
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Management</h1>
          <p className="text-gray-600">Manage your retail locations and client relationships</p>
        </div>
        <button 
          onClick={() => setShowCsvUpload(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Upload className="h-4 w-4 mr-2" />
          Import Stores
        </button>
        <button 
          onClick={() => setShowAddStore(true)}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Store
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search stores..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
            />
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select 
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
            >
              <option value="">All Routes</option>
              {routes.map(route => (
                <option key={route} value={route}>Route {route}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stores Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredStores.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">
              {searchTerm || selectedRoute || selectedCategory
                ? 'Tidak ada toko yang sesuai dengan filter'
                : 'Belum ada toko. Tambahkan toko pertama Anda!'
              }
            </div>
          ) : (
            filteredStores.map((store) => (
          <div key={store.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Store className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{store.store_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(store.category).bg} ${getCategoryColor(store.category).text}`}>
                      {store.category}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Route {store.route}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                <p className="text-sm text-gray-600">{store.address}</p>
              </div>
              
              {store.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <p className="text-sm text-gray-600">{store.phone}</p>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <div className="text-sm">
                  <p className="text-gray-500 text-xs">MSL Recommendations</p>
                  <p className="font-medium text-gray-900">{getMSLCount(store.category)} recommended SKUs</p>
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button 
                  className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  title={`View MSL Guide for ${store.category}`}
                  onClick={() => {
                    // Navigate to MSL Management page and set active tab
                    setActiveTab('msl')
                    // Use setTimeout to ensure tab is set after navigation
                    setTimeout(() => {
                      const event = new CustomEvent('setMSLCategory', { detail: store.category })
                      window.dispatchEvent(event)
                    }, 100)
                  }}
                >
                  MSL Guide
                </button>
                <button 
                  className="flex-1 px-3 py-2 text-sm font-medium text-orange-700 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
                  onClick={() => {
                    if (store.gmaps_link) {
                      window.open(store.gmaps_link, '_blank')
                    } else {
                      alert('Google Maps link not available for this store')
                    }
                  }}
                >
                  Visit
                </button>
                {userRole === 'admin' && (
                  <button 
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    onClick={() => setEditingStore(store)}
                  >
                    Edit
                  </button>
                )}
              </div>

              {/* MSL Preview */}
              {getMSLCount(store.category) > 0 && (
                <div className="pt-3 border-t border-gray-100 mt-3">
                  <p className="text-xs text-gray-500 mb-2">Top MSL Items:</p>
                  <div className="space-y-1">
                    {getTopMSLItems(store.category, 5).map((item, index) => (
                      <div key={index} className="flex items-center text-xs text-gray-600">
                        <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-2">
                          {item.priority}
                        </span>
                        <span className="font-mono mr-2 text-xs">{item.sku_code}</span>
                        <span className="truncate text-xs">{item.product_name}</span>
                      </div>
                    ))}
                    {getMSLCount(store.category) > 5 && (
                      <p className="text-xs text-gray-400">
                        +{getMSLCount(store.category) - 5} more items
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
            ))
          )}
        </div>
      )}

      {/* Edit Store Modal */}
      {editingStore && userRole === 'admin' && (
        <EditStoreModal
          store={editingStore}
          onClose={() => setEditingStore(null)}
          onSuccess={() => {
            fetchStores()
            setEditingStore(null)
          }}
        />
      )}

      {/* Add Store Modal */}
      {showAddStore && (
        <AddStoreModal
          user={user}
          onClose={() => setShowAddStore(false)}
          onSuccess={handleAddStoreSuccess}
        />
      )}

      {/* CSV Upload Modal */}
      {showCsvUpload && (
        <StoreCsvUpload
          user={user}
          onClose={() => setShowCsvUpload(false)}
          onSuccess={handleCsvUploadSuccess}
        />
      )}
    </div>
  )
}

// Edit Store Modal Component
interface EditStoreModalProps {
  store: StoreData
  onClose: () => void
  onSuccess: () => void
}

function EditStoreModal({ store, onClose, onSuccess }: EditStoreModalProps) {
  const [formData, setFormData] = useState({
    store_name: store.store_name,
    store_code: store.store_code,
    category: store.category,
    address: store.address,
    gmaps_link: store.gmaps_link || '',
    route: store.route,
    phone: store.phone || '',
    average_order_value: store.average_order_value?.toString() || '',
    order_frequency: store.order_frequency || '',
    key_contact: store.key_contact || '',
    notes: store.notes || ''
  })
  const [loading, setLoading] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase
        .from('stores')
        .update({
          store_name: formData.store_name,
          store_code: formData.store_code,
          category: formData.category,
          address: formData.address,
          gmaps_link: formData.gmaps_link || null,
          route: formData.route,
          phone: formData.phone || null,
          average_order_value: formData.average_order_value ? parseFloat(formData.average_order_value) : null,
          order_frequency: formData.order_frequency || null,
          key_contact: formData.key_contact || null,
          notes: formData.notes || null
        })
        .eq('id', store.id)

      if (error) throw error
      onSuccess()
    } catch (error) {
      console.error('Error updating store:', error)
      alert('Failed to update store. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Edit Store</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
              <input
                type="text"
                value={formData.store_name}
                onChange={(e) => handleInputChange('store_name', e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Store Code</label>
              <input
                type="text"
                value={formData.store_code}
                onChange={(e) => handleInputChange('store_code', e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
              <input
                type="text"
                value={formData.route}
                onChange={(e) => handleInputChange('route', e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={2}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Maps Link</label>
            <input
              type="url"
              value={formData.gmaps_link}
              onChange={(e) => handleInputChange('gmaps_link', e.target.value)}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Avg Order Value</label>
              <input
                type="number"
                value={formData.average_order_value}
                onChange={(e) => handleInputChange('average_order_value', e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Frequency</label>
              <input
                type="text"
                value={formData.order_frequency}
                onChange={(e) => handleInputChange('order_frequency', e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Contact</label>
              <input
                type="text"
                value={formData.key_contact}
                onChange={(e) => handleInputChange('key_contact', e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={2}
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}