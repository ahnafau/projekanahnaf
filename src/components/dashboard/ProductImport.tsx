'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'

interface ProductImportProps {
  onClose: () => void
  onSuccess: () => void
}

interface ParsedProduct {
  sku_code: string
  product_name: string
  category: string
  unit_price: number
  isValid: boolean
  error?: string
}

export default function ProductImport({ onClose, onSuccess }: ProductImportProps) {
  const [productText, setProductText] = useState('')
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null)

  const exampleFormat = `SKU001 | L'Oréal Paris Voluminous Mascara | Makeup | 12.99
SKU002 | Garnier Fructis Shampoo | Hair Care | 8.49
SKU003 | Maybelline Foundation | Makeup | 15.99`

  const parseProducts = () => {
    const lines = productText.trim().split('\n').filter(line => line.trim())
    const parsed: ParsedProduct[] = []

    lines.forEach((line, index) => {
      const parts = line.split('|').map(part => part.trim())
      
      if (parts.length !== 4) {
        parsed.push({
          sku_code: '',
          product_name: line,
          category: '',
          unit_price: 0,
          isValid: false,
          error: 'Format salah - harus 4 kolom dipisahkan dengan |'
        })
        return
      }

      const [sku, name, category, priceStr] = parts
      const price = parseFloat(priceStr)

      if (!sku || !name || !category || isNaN(price) || price <= 0) {
        parsed.push({
          sku_code: sku,
          product_name: name,
          category: category,
          unit_price: price,
          isValid: false,
          error: 'Data tidak lengkap atau harga tidak valid'
        })
        return
      }

      parsed.push({
        sku_code: sku,
        product_name: name,
        category: category,
        unit_price: price,
        isValid: true
      })
    })

    setParsedProducts(parsed)
    setShowPreview(true)
  }

  const importProducts = async () => {
    setImporting(true)
    const validProducts = parsedProducts.filter(p => p.isValid)
    
    let successCount = 0
    let failedCount = 0

    for (const product of validProducts) {
      try {
        const { error } = await supabase
          .from('products')
          .insert({
            sku_code: product.sku_code,
            product_name: product.product_name,
            category: product.category,
            unit_price: product.unit_price,
            is_active: true
          })

        if (error) {
          console.error('Error inserting product:', error)
          failedCount++
        } else {
          successCount++
        }
      } catch (error) {
        console.error('Error:', error)
        failedCount++
      }
    }

    setImportResult({ success: successCount, failed: failedCount })
    setImporting(false)

    if (successCount > 0) {
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
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Import Produk</h2>
              <p className="text-sm text-gray-600">Import produk dalam jumlah banyak</p>
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
              {/* Format Example */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-900 mb-2">Format yang Diperlukan</h3>
                    <p className="text-sm text-blue-700 mb-3">
                      Setiap baris harus berisi: SKU_CODE | PRODUCT_NAME | CATEGORY | PRICE
                    </p>
                    <div className="bg-white border border-blue-200 rounded p-3 font-mono text-sm">
                      <pre className="whitespace-pre-wrap">{exampleFormat}</pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Input Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daftar Produk
                </label>
                <textarea
                  value={productText}
                  onChange={(e) => setProductText(e.target.value)}
                  placeholder="Paste daftar produk di sini..."
                  className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Tip: Copy dari Excel dengan format yang benar, atau ketik manual sesuai contoh di atas
                </p>
              </div>

              {/* Parse Button */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={parseProducts}
                  disabled={!productText.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Preview Import
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Preview Results */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Preview Import</h3>
                
                {/* Summary */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">
                        {parsedProducts.filter(p => p.isValid).length} Produk Valid
                      </span>
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-900">
                        {parsedProducts.filter(p => !p.isValid).length} Produk Error
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
                        <th className="text-left p-3 font-medium text-gray-600">SKU</th>
                        <th className="text-left p-3 font-medium text-gray-600">Nama Produk</th>
                        <th className="text-left p-3 font-medium text-gray-600">Kategori</th>
                        <th className="text-left p-3 font-medium text-gray-600">Harga</th>
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
                          <td className="p-3 font-mono">{product.sku_code}</td>
                          <td className="p-3">{product.product_name}</td>
                          <td className="p-3">{product.category}</td>
                          <td className="p-3">
                            {product.isValid ? `$${product.unit_price.toFixed(2)}` : product.error}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Import Result */}
              {importResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">
                      Import selesai! {importResult.success} berhasil, {importResult.failed} gagal
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPreview(false)}
                  disabled={importing}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Kembali
                </button>
                <button
                  onClick={importProducts}
                  disabled={importing || parsedProducts.filter(p => p.isValid).length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Import {parsedProducts.filter(p => p.isValid).length} Produk</span>
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