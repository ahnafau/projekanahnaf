'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Upload, FileText, CheckCircle, AlertCircle, X, Download } from 'lucide-react'

interface StoreCsvUploadProps {
  user: User
  onClose: () => void
  onSuccess: () => void
}

interface CsvStore {
  kode_toko: string
  nama_toko: string
  kategori: string
  alamat: string
  google_maps: string
  route: string
  telepon: string
  avg_order_value: string
  frekuensi_order: string
  kontak_utama: string
  catatan: string
  isValid: boolean
  error?: string
  action?: 'INSERT' | 'UPDATE'
}

export default function StoreCsvUpload({ user, onClose, onSuccess }: StoreCsvUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedStores, setParsedStores] = useState<CsvStore[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ added: number; updated: number; failed: number } | null>(null)

  const downloadTemplate = () => {
    const csvContent = `KODE_TOKO,NAMA_TOKO,KATEGORI,ALAMAT,GOOGLE_MAPS,ROUTE,TELEPON,AVG_ORDER_VALUE,FREKUENSI_ORDER,KONTAK_UTAMA,CATATAN
BC001,Beauty Corner,GT Small Cosmetics,"Jl. Sudirman No. 123, Jakarta",https://maps.google.com/...,A,+62812345678,750000,Monthly,Sari Dewi,Toko kosmetik terpercaya
WH002,Wholesale Cantik,GT Wholesale,"Jl. Gajah Mada No. 456, Surabaya",,B,+62823456789,1200000,Bi-weekly,Budi Santoso,Distributor besar
PROV003,Provinsi Beauty,GT PROV,"Jl. Diponegoro No. 789, Bandung",https://maps.google.com/...,C,+62834567890,2000000,Weekly,Maya Sari,Outlet provinsi utama`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'store_template.csv'
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
    const requiredHeaders = ['KODE_TOKO', 'NAMA_TOKO', 'KATEGORI']
    
    // Check if all required headers are present
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header))
    if (missingHeaders.length > 0) {
      alert(`Missing required columns: ${missingHeaders.join(', ')}`)
      return
    }

    // Get column indices
    const kodeIndex = headers.indexOf('KODE_TOKO')
    const namaIndex = headers.indexOf('NAMA_TOKO')
    const kategoriIndex = headers.indexOf('KATEGORI')
    const alamatIndex = headers.indexOf('ALAMAT')
    const gmapsIndex = headers.indexOf('GOOGLE_MAPS')
    const routeIndex = headers.indexOf('ROUTE')
    const teleponIndex = headers.indexOf('TELEPON')
    const avgOrderIndex = headers.indexOf('AVG_ORDER_VALUE')
    const frekuensiIndex = headers.indexOf('FREKUENSI_ORDER')
    const kontakIndex = headers.indexOf('KONTAK_UTAMA')
    const catatanIndex = headers.indexOf('CATATAN')

    // Get existing stores to determine INSERT vs UPDATE
    const { data: existingStores } = await supabase
      .from('stores')
      .select('store_code')
      .eq('created_by', user.id)

    const existingCodes = new Set(existingStores?.map(s => s.store_code) || [])
    const seenCodes = new Set<string>()
    const parsed: CsvStore[] = []

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, '')) // Remove quotes
      
      const kode = values[kodeIndex] || ''
      const nama = values[namaIndex] || ''
      const kategori = values[kategoriIndex] || ''
      const alamat = values[alamatIndex] || ''
      const gmaps = values[gmapsIndex] || ''
      const route = values[routeIndex] || 'A'
      const telepon = values[teleponIndex] || ''
      const avgOrder = values[avgOrderIndex] || '0'
      const frekuensi = values[frekuensiIndex] || ''
      const kontak = values[kontakIndex] || ''
      const catatan = values[catatanIndex] || ''

      // Validation
      let isValid = true
      let error = ''

      // Required fields validation
      if (!kode || !nama || !kategori) {
        isValid = false
        error = `Row ${i + 1}: Missing required fields (KODE_TOKO, NAMA_TOKO, KATEGORI)`
      } else if (seenCodes.has(kode)) {
        isValid = false
        error = `Row ${i + 1}: Duplicate store code in file`
      } else {
        seenCodes.add(kode)
      }

      // Validate avg_order_value if provided
      if (isValid && avgOrder && avgOrder !== '0') {
        const avgOrderNum = parseFloat(avgOrder)
        if (isNaN(avgOrderNum) || avgOrderNum < 0) {
          isValid = false
          error = `Row ${i + 1}: Invalid average order value`
        }
      }

      parsed.push({
        kode_toko: kode,
        nama_toko: nama,
        kategori: kategori,
        alamat: alamat,
        google_maps: gmaps,
        route: route,
        telepon: telepon,
        avg_order_value: avgOrder,
        frekuensi_order: frekuensi,
        kontak_utama: kontak,
        catatan: catatan,
        isValid: isValid,
        error: error,
        action: existingCodes.has(kode) ? 'UPDATE' : 'INSERT'
      })
    }

    setParsedStores(parsed)
    setShowPreview(true)
  }

  const uploadStores = async () => {
    setUploading(true)
    const validStores = parsedStores.filter(s => s.isValid)
    
    let addedCount = 0
    let updatedCount = 0
    let failedCount = 0

    for (const store of validStores) {
      try {
        const storeData = {
          store_code: store.kode_toko,
          store_name: store.nama_toko,
          category: store.kategori,
          address: store.alamat || '',
          gmaps_link: store.google_maps || null,
          route: store.route || 'A',
          phone: store.telepon || null,
          average_order_value: store.avg_order_value ? parseFloat(store.avg_order_value) : 0,
          order_frequency: store.frekuensi_order || null,
          key_contact: store.kontak_utama || null,
          notes: store.catatan || null,
          created_by: user.id
        }

        if (store.action === 'UPDATE') {
          const { error } = await supabase
            .from('stores')
            .update({
              store_name: storeData.store_name,
              category: storeData.category,
              address: storeData.address,
              gmaps_link: storeData.gmaps_link,
              route: storeData.route,
              phone: storeData.phone,
              average_order_value: storeData.average_order_value,
              order_frequency: storeData.order_frequency,
              key_contact: storeData.key_contact,
              notes: storeData.notes
            })
            .eq('store_code', store.kode_toko)
            .eq('created_by', user.id)

          if (error) {
            console.error('Error updating store:', error)
            failedCount++
          } else {
            updatedCount++
          }
        } else {
          const { error } = await supabase
            .from('stores')
            .insert(storeData)

          if (error) {
            console.error('Error inserting store:', error)
            failedCount++
          } else {
            addedCount++
          }
        }
      } catch (error) {
        console.error('Error processing store:', error)
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
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Upload className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Import Stores from CSV</h2>
              <p className="text-sm text-gray-600">Bulk upload store data from CSV file</p>
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
                        Required columns: KODE_TOKO, NAMA_TOKO, KATEGORI
                      </p>
                      <p className="text-sm text-blue-700 mb-3">
                        Optional columns: ALAMAT, GOOGLE_MAPS, ROUTE, TELEPON, AVG_ORDER_VALUE, FREKUENSI_ORDER, KONTAK_UTAMA, CATATAN
                      </p>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• First row must be headers</li>
                        <li>• Use comma as delimiter</li>
                        <li>• Categories: GT PROV, GT Wholesale, GT Small Cosmetics</li>
                        <li>• Routes: A, B, C, D</li>
                        <li>• Existing store codes will be updated, new codes will be added</li>
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
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Preview</h3>
                
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-900">
                        {parsedStores.filter(s => s.isValid && s.action === 'INSERT').length} New Stores
                      </span>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">
                        {parsedStores.filter(s => s.isValid && s.action === 'UPDATE').length} Updates
                      </span>
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-900">
                        {parsedStores.filter(s => !s.isValid).length} Errors
                      </span>
                    </div>
                  </div>
                </div>

                {/* Store List */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left p-3 font-medium text-gray-600">Status</th>
                        <th className="text-left p-3 font-medium text-gray-600">Action</th>
                        <th className="text-left p-3 font-medium text-gray-600">Store Code</th>
                        <th className="text-left p-3 font-medium text-gray-600">Store Name</th>
                        <th className="text-left p-3 font-medium text-gray-600">Category</th>
                        <th className="text-left p-3 font-medium text-gray-600">Route</th>
                        <th className="text-left p-3 font-medium text-gray-600">Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedStores.map((store, index) => (
                        <tr key={index} className={`border-t border-gray-100 ${!store.isValid ? 'bg-red-50' : ''}`}>
                          <td className="p-3">
                            {store.isValid ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                          </td>
                          <td className="p-3">
                            {store.isValid ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                store.action === 'INSERT' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {store.action}
                              </span>
                            ) : (
                              <span className="text-red-600 text-xs">{store.error}</span>
                            )}
                          </td>
                          <td className="p-3 font-mono">{store.kode_toko}</td>
                          <td className="p-3 text-gray-900">{store.nama_toko}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              store.kategori === 'GT PROV' ? 'bg-purple-100 text-purple-800' :
                              store.kategori === 'GT Wholesale' ? 'bg-orange-100 text-orange-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {store.kategori}
                            </span>
                          </td>
                          <td className="p-3 text-gray-900">{store.route}</td>
                          <td className="p-3 text-gray-900">{store.kontak_utama}</td>
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
                  onClick={uploadStores}
                  disabled={uploading || parsedStores.filter(s => s.isValid).length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Confirm Upload ({parsedStores.filter(s => s.isValid).length} stores)</span>
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