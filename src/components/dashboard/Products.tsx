'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Package, Search, Filter, Plus, Tag, Edit } from 'lucide-react'
import ProductImport from './ProductImport'
import ProductCsvUpload from './ProductCsvUpload'

interface ProductsProps {
  user: User
  userRole: string
}

interface Product {
  id: string
  sku_code: string
  product_name: string
  category: string
  unit_price: number
  image_url: string | null
  is_active: boolean
}

interface Promotion {
  id: string
  discount_percentage: number
  start_date: string
  end_date: string
  is_active: boolean
}

interface ProductWithPromotion extends Product {
  promotions?: Promotion[]
}

export default function Products({ user, userRole }: ProductsProps) {
  const [products, setProducts] = useState<ProductWithPromotion[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithPromotion[]>([])
  const [categories, setCategories] = useState<string[]>(['All'])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [showImport, setShowImport] = useState(false)
  const [showCsvUpload, setShowCsvUpload] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductWithPromotion | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, selectedCategory])

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          promotions(
            id,
            discount_percentage,
            start_date,
            end_date,
            is_active
          )
        `)
        .eq('is_active', true)
        .order('product_name')

      if (error) throw error

      setProducts(data || [])
      setFilteredProducts(data || [])
      
      // Extract unique categories
      const uniqueCategories = ['All', ...new Set((data || []).map(p => p.category))]
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
      setFilteredProducts([])
    } finally {
      setLoading(false)
    }
  }

  const filterProducts = () => {
    let filtered = products

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(product => product.category === selectedCategory)
    }

    setFilteredProducts(filtered)
  }

  const handleImportSuccess = () => {
    fetchProducts() // Refresh products after import
  }

  const handleCsvUploadSuccess = () => {
    fetchProducts() // Refresh products after CSV upload
  }

  const getActivePromotion = (product: ProductWithPromotion) => {
    if (!product.promotions) return null
    
    const today = new Date().toISOString().split('T')[0]
    return product.promotions.find(promo => 
      promo.is_active && 
      promo.start_date <= today && 
      promo.end_date >= today
    )
  }

  const getDiscountedPrice = (product: ProductWithPromotion) => {
    const promotion = getActivePromotion(product)
    if (!promotion) return product.unit_price
    
    const discount = product.unit_price * (promotion.discount_percentage / 100)
    return product.unit_price - discount
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Product Catalog</h1>
          <p className="text-sm text-gray-600">Manage your L'Oréal product inventory</p>
        </div>
        <div className="flex gap-2">
          {userRole === 'admin' && (
            <>
              <button 
                onClick={() => setShowCsvUpload(true)}
                className="inline-flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                <Plus className="h-3 w-3 mr-1" />
                Upload CSV
              </button>
            <button 
              onClick={() => setShowImport(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-3 w-3 mr-1" />
              Import Products
            </button>
            </>
          )}
          <button className="inline-flex items-center px-3 py-1.5 text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white rounded hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-sm">
            <Plus className="h-3 w-3 mr-1" />
            Add Product
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  selectedCategory === category
                    ? 'bg-orange-100 text-orange-700 border border-orange-200'
                    : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              {searchTerm || selectedCategory !== 'All' 
                ? 'Tidak ada produk yang sesuai dengan filter'
                : 'Belum ada produk. Tambahkan produk pertama Anda!'
              }
            </div>
          ) : (
            filteredProducts.map((product) => {
              const activePromotion = getActivePromotion(product)
              const discountedPrice = getDiscountedPrice(product)
              const hasDiscount = activePromotion && discountedPrice < product.unit_price
              
              // Category color mapping
              const getCategoryColor = (category: string) => {
                const colors = {
                  'Makeup': { bg: 'bg-pink-100', text: 'text-pink-600', border: 'border-pink-200' },
                  'Hair Care': { bg: 'bg-teal-100', text: 'text-teal-600', border: 'border-teal-200' },
                  'Skincare': { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
                  'Fragrance': { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
                  'Body Care': { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' }
                }
                return colors[category as keyof typeof colors] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' }
              }

              const categoryColor = getCategoryColor(product.category)
              const categoryInitial = product.category.charAt(0).toUpperCase()
              
              return (
                <div key={product.id} className="bg-white rounded border border-gray-200 hover:shadow-sm hover:border-gray-300 transition-all duration-200">
                  <div className="flex items-center p-3 gap-3">
                    {/* Category Indicator */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded ${categoryColor.bg} ${categoryColor.border} border flex items-center justify-center`}>
                      <span className={`text-sm font-bold ${categoryColor.text}`}>
                        {categoryInitial}
                      </span>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 text-xs leading-tight truncate">
                            {product.product_name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-600 font-mono">
                              {product.sku_code}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${categoryColor.bg} ${categoryColor.text}`}>
                              {product.category}
                            </span>
                          </div>
                        </div>
                        
                        {/* Status and Discount Badges */}
                        <div className="flex items-center gap-2 ml-4">
                          {hasDiscount && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              -{activePromotion?.discount_percentage}%
                            </span>
                          )}
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                            product.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {product.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      {/* Price Section */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          {hasDiscount ? (
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-bold text-red-600">
                                Rp {discountedPrice.toLocaleString('id-ID')}
                              </span>
                              <span className="text-xs text-gray-500 line-through">
                                Rp {product.unit_price.toLocaleString('id-ID')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-bold text-gray-900">
                              Rp {product.unit_price.toLocaleString('id-ID')}
                            </span>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        {userRole === 'admin' && (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => setEditingProduct(product)}
                              className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors"
                              title="Edit Product"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <ProductImport
          onClose={() => setShowImport(false)}
          onSuccess={handleImportSuccess}
        />
      )}

      {/* CSV Upload Modal */}
      {showCsvUpload && (
        <ProductCsvUpload
          onClose={() => setShowCsvUpload(false)}
          onSuccess={handleCsvUploadSuccess}
        />
      )}

      {/* Edit Product Modal - Placeholder for now */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Product</h3>
            <p className="text-gray-600 mb-4">Product editing functionality coming soon...</p>
            <div className="flex justify-end">
              <button
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}