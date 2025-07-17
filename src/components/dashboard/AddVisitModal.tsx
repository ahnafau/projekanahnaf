'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Calendar, Store, Package, X, Plus } from 'lucide-react'

interface AddVisitModalProps {
  user: User
  onClose: () => void
  onSuccess: () => void
}

interface Store {
  id: string
  store_name: string
  store_code: string
  address: string
  route: string
  category: string
}

interface Product {
  id: string
  sku_code: string
  product_name: string
  unit_price: number
}

interface MSLItem {
  id: string
  sku_code: string
  product_name: string
  priority: number
}

interface OrderItem {
  product_id: string
  quantity: number
  unit_price: number
  discount_percentage: number
}

export default function AddVisitModal({ user, onClose, onSuccess }: AddVisitModalProps) {
  const [stores, setStores] = useState<Store[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [mslItems, setMslItems] = useState<MSLItem[]>([])
  const [routes, setRoutes] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [filteredStores, setFilteredStores] = useState<Store[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [storeSearch, setStoreSearch] = useState('')
  const [productSearches, setProductSearches] = useState<{[key: number]: string}>({})
  const [selectedRoute, setSelectedRoute] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedStoreData, setSelectedStoreData] = useState<Store | null>(null)
  const [isNewStore, setIsNewStore] = useState(false)
  const [newStoreData, setNewStoreData] = useState({
    store_name: '',
    store_code: '',
    category: '',
    address: '',
    route: 'A'
  })
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [hasOrder, setHasOrder] = useState(false)
  const [noOrderReason, setNoOrderReason] = useState('')
  const [notes, setNotes] = useState('')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingStores, setLoadingStores] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingMSL, setLoadingMSL] = useState(false)

  const noOrderReasons = [
    'Toko tutup',
    'Stock masih ada',
    'Owner tidak ada',
    'Harga tidak masuk',
    'Orderan tidak dikirim',
    'Lainnya'
  ]

  const calculateLineTotal = (item: OrderItem): number => {
    const subtotal = item.quantity * item.unit_price
    const discount = subtotal * (item.discount_percentage / 100)
    return subtotal - discount
  }

  const addOrderItem = () => {
    setOrderItems(prev => [...prev, {
      product_id: '',
      quantity: 1,
      unit_price: 0,
      discount_percentage: 0
    }])
  }

  const removeOrderItem = (index: number) => {
    setOrderItems(prev => prev.filter((_, i) => i !== index))
    setProductSearches(prev => {
      const newSearches = { ...prev }
      delete newSearches[index]
      return newSearches
    })
  }

  const updateOrderItem = (index: number, field: keyof OrderItem, value: any) => {
    setOrderItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ))
    
    // Auto-fill unit price when product is selected
    if (field === 'product_id' && value) {
      const selectedProduct = products.find(p => p.id === value)
      if (selectedProduct) {
        setOrderItems(prev => prev.map((item, i) => 
          i === index ? { ...item, unit_price: selectedProduct.unit_price } : item
        ))
      }
    }
  }

  const updateProductSearch = (index: number, search: string) => {
    setProductSearches(prev => ({ ...prev, [index]: search }))
  }

  useEffect(() => {
    fetchStores()
    fetchRoutesAndCategories()
  }, [])

  useEffect(() => {
    if (selectedCategory) {
      fetchMSLItems()
    }
  }, [selectedCategory])

  useEffect(() => {
    if (hasOrder) {
      fetchProducts()
    }
  }, [hasOrder])

  useEffect(() => {
    let filtered = stores

    // Filter by route
    if (selectedRoute) {
      filtered = filtered.filter(store => store.route === selectedRoute)
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(store => store.category === selectedCategory)
    }

    // Filter by search term
    if (storeSearch.trim()) {
      filtered = filtered.filter(store =>
        store.store_name.toLowerCase().includes(storeSearch.toLowerCase()) ||
        store.store_code.toLowerCase().includes(storeSearch.toLowerCase())
      )
    }

    setFilteredStores(filtered)
  }, [stores, selectedRoute, selectedCategory, storeSearch])

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id, store_name, store_code, address, route, category')
        .eq('created_by', user.id)
        .order('store_name')

      if (error) throw error
      setStores(data || [])
    } catch (error) {
      console.error('Error fetching stores:', error)
    } finally {
      setLoadingStores(false)
    }
  }

  const fetchRoutesAndCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('route, category')
        .eq('created_by', user.id)

      if (error) throw error

      const uniqueRoutes = [...new Set((data || []).map(s => s.route).filter(Boolean))].sort()
      const uniqueCategories = [...new Set((data || []).map(s => s.category).filter(Boolean))].sort()
      
      setRoutes(uniqueRoutes)
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error fetching routes and categories:', error)
    }
  }

  const fetchMSLItems = async () => {
    if (!selectedCategory) return
    
    setLoadingMSL(true)
    try {
      const { data, error } = await supabase
        .from('msl_items')
        .select('id, sku_code, product_name, priority')
        .eq('category', selectedCategory)
        .order('priority')

      if (error) throw error
      setMslItems(data || [])
    } catch (error) {
      console.error('Error fetching MSL items:', error)
      setMslItems([])
    } finally {
      setLoadingMSL(false)
    }
  }

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku_code, product_name, unit_price')
        .eq('is_active', true)
        .order('product_name')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleStoreSelect = (storeId: string) => {
    setSelectedStore(storeId)
    const store = stores.find(s => s.id === storeId)
    setSelectedStoreData(store || null)
  }

  function getFilteredProductsForItem(index: number): Product[] {
    const search = productSearches[index] || ''
    let filtered = products
    
    if (search.trim()) {
      filtered = filtered.filter(product =>
        product.product_name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku_code.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Sort MSL products first if we have MSL data for this category
    if (mslItems.length > 0) {
      const mslSkus = new Set(mslItems.map(item => item.sku_code))
      
      return filtered.sort((a, b) => {
        const aIsMSL = mslSkus.has(a.sku_code)
        const bIsMSL = mslSkus.has(b.sku_code)
        
        if (aIsMSL && !bIsMSL) return -1
        if (!aIsMSL && bIsMSL) return 1
        
        // If both are MSL, sort by priority
        if (aIsMSL && bIsMSL) {
          const aPriority = mslItems.find(item => item.sku_code === a.sku_code)?.priority || 999
          const bPriority = mslItems.find(item => item.sku_code === b.sku_code)?.priority || 999
          return aPriority - bPriority
        }
        
        return a.product_name.localeCompare(b.product_name)
      })
    }

    return filtered
  }

  const isProductMSL = (skuCode: string): boolean => {
    return mslItems.some(item => item.sku_code === skuCode)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStore && !isNewStore) return
    if (isNewStore && (!newStoreData.store_name || !newStoreData.store_code || !newStoreData.category)) return
    if (!hasOrder && !noOrderReason) return

    setLoading(true)
    try {
      let storeId = selectedStore

      // Create new store if needed
      if (isNewStore) {
        const { data: newStore, error: storeError } = await supabase
          .from('stores')
          .insert({
            store_name: newStoreData.store_name,
            store_code: newStoreData.store_code,
            category: newStoreData.category,
            address: newStoreData.address,
            route: newStoreData.route,
            created_by: user.id
          })
          .select()
          .single()

        if (storeError) throw storeError
        storeId = newStore.id
      }

      // Create visit
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .insert({
          salesman_id: user.id,
          store_id: storeId,
          visit_date: visitDate,
          has_order: hasOrder,
          notes: hasOrder ? (notes || null) : noOrderReason
        })
        .select()
        .single()

      if (visitError) throw visitError

      // Create order items if there's an order
      if (hasOrder && orderItems.length > 0) {
        const validOrderItems = orderItems.filter(item => 
          item.product_id && item.quantity > 0 && item.unit_price > 0
        )

        if (validOrderItems.length > 0) {
          const orderInserts = validOrderItems.map(item => ({
            visit_id: visitData.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percentage: item.discount_percentage,
            line_total: calculateLineTotal(item)
          }))

          const { error: orderError } = await supabase
            .from('visit_orders')
            .insert(orderInserts)

          if (orderError) throw orderError
        }
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating visit:', error)
      alert('Gagal menyimpan kunjungan. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Tambah Kunjungan Toko</h2>
              <p className="text-sm text-gray-600">Catat kunjungan dan pesanan hari ini</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Visit Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Kunjungan
            </label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              required
            />
          </div>

          {/* Route Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Route
            </label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            >
              <option value="">Semua Route</option>
              {routes.map((route) => (
                <option key={route} value={route}>Route {route}</option>
              ))}
            </select>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pilih Kategori Toko
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
            >
              <option value="">Semua Kategori</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* New Store Option */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={isNewStore}
                onChange={(e) => setIsNewStore(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Toko Baru/Toko Belum Terdaftar</span>
                <p className="text-xs text-gray-500">Tidak menemukan toko?</p>
              </div>
            </label>
          </div>

          {isNewStore ? (
            /* New Store Form */
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900">Data Toko Baru</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Toko *
                  </label>
                  <input
                    type="text"
                    value={newStoreData.store_name}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, store_name: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nama toko"
                    required={isNewStore}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kode Toko *
                  </label>
                  <input
                    type="text"
                    value={newStoreData.store_code}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, store_code: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Kode toko"
                    required={isNewStore}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kategori *
                  </label>
                  <select
                    value={newStoreData.category}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={isNewStore}
                  >
                    <option value="">Pilih kategori...</option>
                    {categories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Route *
                  </label>
                  <select
                    value={newStoreData.route}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, route: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={isNewStore}
                  >
                    <option value="">Pilih route...</option>
                    {routes.map(route => (
                      <option key={route} value={route}>Route {route}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alamat
                  </label>
                  <input
                    type="text"
                    value={newStoreData.address}
                    onChange={(e) => setNewStoreData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Alamat toko (opsional)"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pilih Toko
              </label>
              {loadingStores ? (
                <div className="p-3 text-gray-500">Memuat daftar toko...</div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={storeSearch}
                    onChange={(e) => setStoreSearch(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Cari toko..."
                  />
                  <select
                    value={selectedStore}
                    onChange={(e) => handleStoreSelect(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                    required={!isNewStore}
                  >
                    <option value="">Pilih toko...</option>
                    {filteredStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.store_name} ({store.store_code}) - {store.category} - Route {store.route}
                      </option>
                    ))}
                  </select>
                  {filteredStores.length === 0 && storeSearch && (
                    <p className="text-sm text-gray-500 mt-1">
                      Tidak ada toko yang ditemukan. Coba kata kunci lain atau centang "Toko Baru".
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* MSL Recommendations */}
          {selectedStoreData && mslItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-3">
                Top 5 MSL Recommendations untuk {selectedStoreData.category}
              </h3>
              {loadingMSL ? (
                <div className="text-blue-700">Memuat rekomendasi MSL...</div>
              ) : (
                <div className="space-y-2">
                  {mslItems.slice(0, 5).map((item, index) => (
                    <div key={item.id} className="flex items-center text-sm text-blue-800">
                      <span className="w-6 h-6 bg-blue-200 text-blue-800 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                        {item.priority}
                      </span>
                      <span className="font-mono mr-3 text-xs">{item.sku_code}</span>
                      <span className="text-xs">{item.product_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Has Order Toggle */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={hasOrder}
                onChange={(e) => setHasOrder(e.target.checked)}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Ada pesanan produk</span>
            </label>
          </div>

          {/* No Order Reason */}
          {!hasOrder && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alasan Tidak Order *
              </label>
              <select
                value={noOrderReason}
                onChange={(e) => setNoOrderReason(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                required={!hasOrder}
              >
                <option value="">Pilih alasan...</option>
                {noOrderReasons.map((reason) => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
          )}

          {/* Order Items */}
          {hasOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Daftar Pesanan</h3>
                <button
                  type="button"
                  onClick={addOrderItem}
                  className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah Item
                </button>
              </div>

              {loadingProducts ? (
                <div className="p-3 text-gray-500">Memuat daftar produk...</div>
              ) : (
                <div className="space-y-3">
                  {orderItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={productSearches[index] || ''}
                          onChange={(e) => updateProductSearch(index, e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                          placeholder="Cari produk..."
                        />
                        <select
                          value={item.product_id}
                          onChange={(e) => updateOrderItem(index, 'product_id', e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Pilih produk...</option>
                          {getFilteredProductsForItem(index).map((product) => (
                            <option key={product.id} value={product.id}>
                              {isProductMSL(product.sku_code) ? '[MSL] ' : ''}{product.sku_code} - {product.product_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          placeholder="Qty"
                          className="w-full p-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateOrderItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          placeholder="Harga"
                          className="w-full p-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount_percentage}
                          onChange={(e) => updateOrderItem(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                          placeholder="Disc %"
                          className="w-full p-2 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-1">
                        <button
                          type="button"
                          onClick={() => removeOrderItem(index)}
                          className="w-full p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {orderItems.length > 0 && (
                    <div className="text-right">
                      <span className="text-lg font-semibold text-gray-900">
                        Total: Rp {orderItems.reduce((sum, item) => sum + calculateLineTotal(item), 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan (Opsional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
              placeholder="Tambahkan catatan kunjungan..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || (!selectedStore && !isNewStore) || (isNewStore && (!newStoreData.store_name || !newStoreData.store_code || !newStoreData.category)) || (!hasOrder && !noOrderReason)}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Calendar className="h-3 w-3" />
                  <span>Simpan Kunjungan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}