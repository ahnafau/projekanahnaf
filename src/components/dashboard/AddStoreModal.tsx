'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Store, X, MapPin, DollarSign, Package } from 'lucide-react'

interface AddStoreModalProps {
  user: User
  onClose: () => void
  onSuccess: () => void
}

interface Product {
  id: string
  sku_code: string
  product_name: string
}

export default function AddStoreModal({ user, onClose, onSuccess }: AddStoreModalProps) {
  const [formData, setFormData] = useState({
    store_name: '',
    store_code: '',
    category: '',
    address: '',
    gmaps_link: '',
    route: 'A',
    phone: '',
    average_order_value: '',
    order_frequency: '',
    key_contact: '',
    notes: '',
    recommended_skus: [] as string[]
  })
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [routes, setRoutes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)

  useEffect(() => {
    fetchProducts()
    fetchCategoriesAndRoutes()
  }, [])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku_code, product_name')
        .eq('is_active', true)
        .order('sku_code')

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }

  const fetchCategoriesAndRoutes = async () => {
    try {
      let query = supabase
        .from('stores')
        .select('category, route')

      const { data, error } = await query
      if (error) throw error

      // Extract unique categories and routes
      const uniqueCategories = Array.from(new Set((data || []).map(s => s.category).filter(Boolean)))
      const uniqueRoutes = Array.from(new Set((data || []).map(s => s.route).filter(Boolean)))
      
      setCategories(uniqueCategories.sort())
      setRoutes(uniqueRoutes.sort())
      
      // Set default category if available
      if (uniqueCategories.length > 0 && !formData.category) {
        setFormData(prev => ({ ...prev, category: uniqueCategories[0] }))
      }
      
      // Set default route if available
      if (uniqueRoutes.length > 0) {
        setFormData(prev => ({ ...prev, route: uniqueRoutes[0] }))
      }
    } catch (error) {
      console.error('Error fetching categories and routes:', error)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSkuToggle = (skuId: string) => {
    setFormData(prev => ({
      ...prev,
      recommended_skus: prev.recommended_skus.includes(skuId)
        ? prev.recommended_skus.filter(id => id !== skuId)
        : [...prev.recommended_skus, skuId]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.store_name || !formData.store_code) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('stores')
        .insert({
          store_name: formData.store_name,
          store_code: formData.store_code,
          category: formData.category,
          address: formData.address,
          gmaps_link: formData.gmaps_link || null,
          route: formData.route,
          phone: formData.phone || null,
          average_order_value: formData.average_order_value ? parseFloat(formData.average_order_value) : 0,
          order_frequency: formData.order_frequency || null,
          key_contact: formData.key_contact || null,
          notes: formData.notes || null,
          created_by: user.id
        })

      if (error) throw error

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating store:', error)
      alert('Gagal menyimpan toko. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Store className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Tambah Toko Baru</h2>
              <p className="text-sm text-gray-600">Daftarkan toko baru ke dalam sistem</p>
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
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Toko *
              </label>
              <input
                type="text"
                value={formData.store_name}
                onChange={(e) => handleInputChange('store_name', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Contoh: Beauty Corner"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kode Toko *
              </label>
              <input
                type="text"
                value={formData.store_code}
                onChange={(e) => handleInputChange('store_code', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Contoh: BC001"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategori Toko *
              </label>
              <div className="space-y-2">
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  required
                >
                  <option value="">Pilih kategori...</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Atau ketik kategori baru..."
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Alamat
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={2}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Alamat lengkap toko"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Link Google Maps
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="url"
                value={formData.gmaps_link}
                onChange={(e) => handleInputChange('gmaps_link', e.target.value)}
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="https://maps.google.com/..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Route
              </label>
              <div className="space-y-2">
                <select
                  value={formData.route}
                  onChange={(e) => handleInputChange('route', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="">Pilih route...</option>
                  {routes.map(route => (
                    <option key={route} value={route}>Route {route}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formData.route}
                  onChange={(e) => handleInputChange('route', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="Atau ketik route baru..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telepon
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="+62 xxx xxx xxxx"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rata-rata Order Value
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-400">Rp</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.average_order_value}
                  onChange={(e) => handleInputChange('average_order_value', e.target.value)}
                  className="w-full pl-8 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frekuensi Order
              </label>
              <select
                value={formData.order_frequency}
                onChange={(e) => handleInputChange('order_frequency', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              >
                <option value="">Pilih frekuensi...</option>
                <option value="Weekly">Mingguan</option>
                <option value="Bi-weekly">Dua Minggu</option>
                <option value="Monthly">Bulanan</option>
                <option value="Quarterly">Tiga Bulan</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kontak Utama
              </label>
              <input
                type="text"
                value={formData.key_contact}
                onChange={(e) => handleInputChange('key_contact', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                placeholder="Nama kontak utama"
              />
            </div>
          </div>

          {/* Recommended SKUs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rekomendasi SKU
            </label>
            {loadingProducts ? (
              <div className="p-3 text-gray-500">Memuat produk...</div>
            ) : (
              <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                {products.map((product) => (
                  <label key={product.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.recommended_skus.includes(product.id)}
                      onChange={() => handleSkuToggle(product.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">
                      {product.sku_code} - {product.product_name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              placeholder="Catatan tambahan tentang toko..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !formData.store_name || !formData.store_code}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Store className="h-4 w-4" />
                  <span>Simpan Toko</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}