'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, FileText, CheckCircle, AlertCircle, X, Download, Trash2 } from 'lucide-react'

interface MSLCsvUploadProps {
  onClose: () => void
  onSuccess: () => void
}

interface CsvMSLItem {
  category: string
  sku_code: string
  product_name: string
  priority: number
  notes: string
  isValid: boolean
  error?: string
}

interface CategorySummary {
  category: string
  count: number
  items: CsvMSLItem[]
}

export default function MSLCsvUpload({ onClose, onSuccess }: MSLCsvUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedItems, setParsedItems] = useState<CsvMSLItem[]>([])
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ [category: string]: number } | null>(null)

  const downloadTemplate = () => {
    const csvContent = `CATEGORY,SKU_CODE,PRODUCT_NAME,PRIORITY,NOTES
GT PROV,LOR001,L'Oreal Paris Voluminous Mascara,1,Top seller - high margin
GT PROV,LOR002,L'Oreal Paris Foundation,2,Popular shade range
GT PROV,GAR001,Garnier Fructis Shampoo,3,Volume driver
GT Wholesale,LOR004,L'Oreal Wholesale Pack A,1,Bulk discount available
GT Wholesale,GAR002,Garnier Wholesale Bundle,2,High volume product
GT Small Cosmetics,LOR005,L'Oreal Mini Lipstick Set,1,Perfect for small stores
GT Small Cosmetics,GAR003,Garnier Travel Size,2,Impulse purchase`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'msl_template.csv'
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
    const requiredHeaders = ['CATEGORY', 'SKU_CODE', 'PRODUCT_NAME', 'PRIORITY']
    
    // Check if all required headers are present
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header))
    if (missingHeaders.length > 0) {
      alert(`Missing required columns: ${missingHeaders.join(', ')}`)
      return
    }

    // Get column indices
    const categoryIndex = headers.indexOf('CATEGORY')
    const skuIndex = headers.indexOf('SKU_CODE')
    const nameIndex = headers.indexOf('PRODUCT_NAME')
    const priorityIndex = headers.indexOf('PRIORITY')
    const notesIndex = headers.indexOf('NOTES')

    const seenSkus = new Set<string>()
    const parsed: CsvMSLItem[] = []

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '')) // Remove quotes
      
      const category = values[categoryIndex] || ''
      const sku = values[skuIndex] || ''
      const name = values[nameIndex] || ''
      const priorityStr = values[priorityIndex] || ''
      const notes = notesIndex >= 0 ? values[notesIndex] || '' : ''

      // Validation
      let isValid = true
      let error = ''

      // Required fields validation
      if (!category || !sku || !name || !priorityStr) {
        isValid = false
        error = `Row ${i + 1}: Missing required fields (CATEGORY, SKU_CODE, PRODUCT_NAME, PRIORITY)`
      } else if (seenSkus.has(`${category}-${sku}`)) {
        isValid = false
        error = `Row ${i + 1}: Duplicate SKU in same category`
      } else {
        seenSkus.add(`${category}-${sku}`)
      }

      const priority = parseInt(priorityStr)
      if (isValid && (isNaN(priority) || priority < 1)) {
        isValid = false
        error = `Row ${i + 1}: Invalid priority (must be positive integer)`
      }

      parsed.push({
        category,
        sku_code: sku,
        product_name: name,
        priority,
        notes,
        isValid,
        error
      })
    }

    setParsedItems(parsed)

    // Create category summary
    const validItems = parsed.filter(item => item.isValid)
    const categoryMap = new Map<string, CsvMSLItem[]>()
    
    validItems.forEach(item => {
      if (!categoryMap.has(item.category)) {
        categoryMap.set(item.category, [])
      }
      categoryMap.get(item.category)!.push(item)
    })

    const summary: CategorySummary[] = Array.from(categoryMap.entries()).map(([category, items]) => ({
      category,
      count: items.length,
      items: items.sort((a, b) => a.priority - b.priority)
    }))

    setCategorySummary(summary)
    setShowPreview(true)
  }

  const uploadMSL = async () => {
    setUploading(true)
    const validItems = parsedItems.filter(item => item.isValid)
    
    try {
      // Get unique categories from valid items
      const categoriesToUpdate = [...new Set(validItems.map(item => item.category))]
      
      // Delete existing MSL items only for categories being updated
      for (const category of categoriesToUpdate) {
        const { error: deleteError } = await supabase
          .from('msl_items')
          .delete()
          .eq('category', category)

        if (deleteError) throw deleteError
      }

      // Insert new MSL items
      const insertData = validItems.map(item => ({
        category: item.category,
        sku_code: item.sku_code,
        product_name: item.product_name,
        priority: item.priority,
        notes: item.notes || null
      }))

      const { error: insertError } = await supabase
        .from('msl_items')
        .insert(insertData)

      if (insertError) throw insertError

      // Create result summary
      const result: { [category: string]: number } = {}
      categorySummary.forEach(cat => {
        result[cat.category] = cat.count
      })

      setUploadResult(result)
      
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 2000)

    } catch (error) {
      console.error('Error uploading MSL:', error)
      alert('Failed to upload MSL. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Upload MSL (Must Selling List)</h2>
              <p className="text-sm text-gray-600">Upload CSV to completely replace current MSL data</p>
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
              {/* Warning Notice */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-yellow-900 mb-2">Complete MSL Replacement</h3>
                    <p className="text-sm text-yellow-700 mb-3">
                      This upload will completely replace ALL existing MSL data. All current MSL items will be deleted and replaced with the CSV content.
                    </p>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Use this for monthly MSL updates</li>
                      <li>• Ensure your CSV contains the complete MSL for all categories</li>
                      <li>• Missing categories will be removed from the system</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Template Download */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-blue-900 mb-2">CSV Format Required</h3>
                      <p className="text-sm text-blue-700 mb-3">
                        Required columns: CATEGORY, SKU_CODE, PRODUCT_NAME, PRIORITY
                      </p>
                      <p className="text-sm text-blue-700 mb-3">
                        Optional columns: NOTES
                      </p>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• First row must be headers</li>
                        <li>• Use comma as delimiter</li>
                        <li>• Priority must be positive integers (1, 2, 3...)</li>
                        <li>• Categories can be any text value</li>
                        <li>• Lower priority numbers = higher importance</li>
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
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Parse CSV
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Preview Results */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">MSL Upload Preview</h3>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">
                        {parsedItems.filter(item => item.isValid).length} Valid Items
                      </span>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">
                        {categorySummary.length} Categories
                      </span>
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-900">
                        {parsedItems.filter(item => !item.isValid).length} Errors
                      </span>
                    </div>
                  </div>
                </div>

                {/* Category Summary */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">Categories to be updated:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {categorySummary.map((cat) => (
                      <div key={cat.category} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="font-medium text-gray-900">{cat.category}</div>
                        <div className="text-sm text-gray-600">{cat.count} MSL items</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Error Items */}
                {parsedItems.filter(item => !item.isValid).length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-red-900 mb-3">Items with errors:</h4>
                    <div className="max-h-32 overflow-y-auto border border-red-200 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-red-50 sticky top-0">
                          <tr>
                            <th className="text-left p-3 font-medium text-red-700">Category</th>
                            <th className="text-left p-3 font-medium text-red-700">SKU</th>
                            <th className="text-left p-3 font-medium text-red-700">Product</th>
                            <th className="text-left p-3 font-medium text-red-700">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedItems.filter(item => !item.isValid).map((item, index) => (
                            <tr key={index} className="border-t border-red-100">
                              <td className="p-3">{item.category}</td>
                              <td className="p-3 font-mono text-gray-900">{item.sku_code}</td>
                              <td className="p-3 text-gray-900">{item.product_name}</td>
                              <td className="p-3 text-red-600 text-xs">{item.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Result */}
              {uploadResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">MSL Updated Successfully!</span>
                  </div>
                  <div className="text-sm text-green-700">
                    {Object.entries(uploadResult).map(([category, count]) => (
                      <span key={category} className="mr-4">
                        {category} ({count} SKUs)
                      </span>
                    ))}
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
                  onClick={uploadMSL}
                  disabled={uploading || parsedItems.filter(item => item.isValid).length === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Replace All MSL Data ({parsedItems.filter(item => item.isValid).length} items)</span>
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