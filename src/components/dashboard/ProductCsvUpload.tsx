'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react'

interface ProductCsvUploadProps {
  onClose: () => void
  onSuccess: () => void
}

interface CsvProduct {
  sku_code: string
  product_name: string
  brand: string
  category: string
  price: number
  discount: number
  isValid: boolean
  error?: string
  action?: 'INSERT' | 'UPDATE'
}

export default function ProductCsvUpload({ onClose, onSuccess }: ProductCsvUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedProducts, setParsedProducts] = useState<CsvProduct[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ added: number; updated: number; failed: number } | null>(null)

  const downloadTemplate = () => {
    const csvContent = `SKU_CODE,PRODUCT_NAME,BRAND,CATEGORY,PRICE,DISCOUNT
SKU001,L'Oréal Paris Voluminous Mascara,L'Oréal Paris,Makeup,185000,10
SKU002,Garnier Fructis Shampoo,Garnier,Hair Care,45000,0
SKU003,Maybelline Foundation,Maybelline,Makeup,125000,15`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'product_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
    } else {
      alert('Please select a valid CSV file')
    }
  }

  const parseCsv = async () => {
    if (!file) return

    const text = await file.text()
    const lines = text.trim().split('\n')
    
    if (lines.length < 2) {
      alert('CSV file must have at least a header row and one data row')
      return
    }

    const headers = lines[0].split(',').map(h => h.trim().toUpperCase())
    const requiredHeaders = ['SKU_CODE', 'PRODUCT_NAME', 'BRAND', 'CATEGORY', 'PRICE']
    
    // Check if all required headers are present
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header))
    if (missingHeaders.length > 0) {
      alert(`Missing required columns: ${missingHeaders.join(', ')}`)
      return
    }

    // Get column indices
    const skuIndex = headers.indexOf('SKU_CODE')
    const nameIndex = headers.indexOf('PRODUCT_NAME')
    const brandIndex = headers.indexOf('BRAND')
    const categoryIndex = headers.indexOf('CATEGORY')
    const priceIndex = headers.indexOf('PRICE')
    const discountIndex = headers.indexOf('DISCOUNT')

    // Get existing products to determine INSERT vs UPDATE
    const { data: existingProducts } = await supabase
      .from('products')
      .select('sku_code')

    const existingSkus = new Set(existingProducts?.map(p => p.sku_code) || [])
    const seenSkus = new Set<string>()
    const parsed: CsvProduct[] = []

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      
      if (values.length < requiredHeaders.length) {
        parsed.push({
          sku_code: values[skuIndex] || '',
          product_name: values[nameIndex] || '',
          brand: values[brandIndex] || '',
          category: values[categoryIndex] || '',
          price: 0,
          discount: 0,
          isValid: false,
          error: `Row ${i + 1}: Insufficient columns`
        })
        continue
      }

      const sku = values[skuIndex]
      const name = values[nameIndex]
      const brand = values[brandIndex]
      const category = values[categoryIndex]
      const priceStr = values[priceIndex]
      const discountStr = discountIndex >= 0 ? values[discountIndex] : '0'

      // Validation
      let isValid = true
      let error = ''

      if (!sku || !name || !brand || !category || !priceStr) {
        isValid = false
        error = `Row ${i + 1}: Missing required fields`
      } else if (seenSkus.has(sku)) {
        isValid = false
        error = `Row ${i + 1}: Duplicate SKU in file`
      } else {
        seenSkus.add(sku)
      }

      const price = parseFloat(priceStr)
      const discount = parseFloat(discountStr) || 0

      if (isValid && (isNaN(price) || price <= 0)) {
        isValid = false
        error = `Row ${i + 1}: Invalid price`
      }

      if (isValid && (isNaN(discount) || discount < 0 || discount > 100)) {
        isValid = false
        error = `Row ${i + 1}: Invalid discount (must be 0-100)`
      }

      parsed.push({
        sku_code: sku,
        product_name: name,
        brand: brand,
        category: category,
        price: price,
        discount: discount,
        isValid: isValid,
        error: error,
        action: existingSkus.has(sku) ? 'UPDATE' : 'INSERT'
      })
    }

    setParsedProducts(parsed)
    setShowPreview(true)
  }

  const uploadProducts = async () => {
    setUploading(true)
    const validProducts = parsedProducts.filter(p => p.isValid)
    
    let addedCount = 0
    let updatedCount = 0
    let failedCount = 0

    for (const product of validProducts) {
      try {
        if (product.action === 'UPDATE') {
          const { error } = await supabase
            .from('products')
            .update({
              product_name: product.product_name,
              category: product.category,
              unit_price: product.price,
              updated_at: new Date().toISOString()
            })
            .eq('sku_code', product.sku_code)

          if (error) {
            console.error('Error updating product:', error)
            failedCount++
          } else {
            updatedCount++
          }
        } else {
          const { error } = await supabase
            .from('products')
            .insert({
              sku_code: product.sku_code,
              product_name: product.product_name,
              category: product.category,
              unit_price: product.price,
              is_active: true
            })

          if (error) {
            console.error('Error inserting product:', error)
            failedCount++
          } else {
            addedCount++
          }
        }
      } catch (error) {
        console.error('Error processing product:', error)
        failedCount++
      }
    }

    setUploadResult({ added: addedCount, updated: updatedCount, failed: failedCount })
    setUploading(false)

    if (addedCount > 0 || updatedCount > 0) {
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 2000)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Upload className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Upload CSV Products</h2>
              <p className="text-sm text-gray-600">Import products from CSV file</p>
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
          {!showPreview ? (
            <>
              {/* Template Download */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-blue-900 mb-2">CSV Format Required</h3>
                      <p className="text-sm text-blue-700 mb-3">
                        Columns: SKU_CODE, PRODUCT_NAME, BRAND, CATEGORY, PRICE, DISCOUNT (optional)
                      </p>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• First row must be headers</li>
                        <li>• Use comma as delimiter</li>
                        <li>• DISCOUNT column is optional (defaults to 0)</li>
                        <li>• Existing SKUs will be updated, new SKUs will be added</li>
                      </ul>
                    </div>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Template
                  </button>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {file && (
                  <p className="text-sm text-gray-600 mt-2">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Parse Button */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={parseCsv}
                  disabled={!file}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Parse CSV
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Preview Results */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Preview</h3>
                
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">
                        {parsedProducts.filter(p => p.isValid && p.action === 'INSERT').length} New Products
                      </span>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">
                        {parsedProducts.filter(p => p.isValid && p.action === 'UPDATE').length} Updates
                      </span>
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-900">
                        {parsedProducts.filter(p => !p.isValid).length} Errors
                      </span>
                    </div>
                  </div>
                </div>

                {/* Product List */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 font-medium text-gray-600">Status</th>
                        <th className="text-left p-3 font-medium text-gray-600">Action</th>
                        <th className="text-left p-3 font-medium text-gray-600">SKU</th>
                        <th className="text-left p-3 font-medium text-gray-600">Product Name</th>
                        <th className="text-left p-3 font-medium text-gray-600">Brand</th>
                        <th className="text-left p-3 font-medium text-gray-600">Category</th>
                        <th className="text-left p-3 font-medium text-gray-600">Price</th>
                        <th className="text-left p-3 font-medium text-gray-600">Discount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedProducts.map((product, index) => (
                        <tr key={index} className={`border-t border-gray-100 ${!product.isValid ? 'bg-red-50' : ''}`}>
                          <td className="p-3">
                            {product.isValid ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                          </td>
                          <td className="p-3">
                            {product.isValid ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                product.action === 'INSERT' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {product.action}
                              </span>
                            ) : (
                              <span className="text-red-600 text-xs">{product.error}</span>
                            )}
                          </td>
                          <td className="p-3 font-mono">{product.sku_code}</td>
                          <td className="p-3 text-gray-900">{product.product_name}</td>
                          <td className="p-3 text-gray-900">{product.brand}</td>
                          <td className="p-3 text-gray-900">{product.category}</td>
                          <td className="p-3">
                            {product.isValid ? (
                              <span className="text-gray-900">Rp {product.price.toLocaleString('id-ID')}</span>
                            ) : (
                              <span className="text-red-600">{product.error}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {product.isValid ? (
                              <span className="text-gray-900">{product.discount}%</span>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Upload Result */}
              {uploadResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">
                      Upload complete! {uploadResult.added} added, {uploadResult.updated} updated, {uploadResult.failed} failed
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPreview(false)}
                  disabled={uploading}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={uploadProducts}
                  disabled={uploading || parsedProducts.filter(p => p.isValid).length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Confirm Upload ({parsedProducts.filter(p => p.isValid).length} products)</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}