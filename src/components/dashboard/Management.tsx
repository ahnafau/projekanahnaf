'use client'

import { User } from '@supabase/supabase-js'
import { Users, Settings, Shield, Bell, Database, Upload } from 'lucide-react'
import { useState } from 'react'
import ProductImport from './ProductImport'

interface ManagementProps {
  user: User
  userRole: string
}

export default function Management({ user, userRole }: ManagementProps) {
  const [showProductImport, setShowProductImport] = useState(false)

  const managementSections = [
    {
      title: 'User Management',
      description: 'Manage sales team members and permissions',
      icon: Users,
      color: 'blue',
      items: ['Add new users', 'Assign roles', 'Manage permissions', 'View user activity']
    },
    {
      title: 'Product Management',
      description: 'Manage product catalog and inventory',
      icon: Upload,
      color: 'green',
      items: [
        { name: 'Import Products', action: () => setShowProductImport(true) },
        'Manage categories',
        'Update pricing',
        'Product analytics'
      ]
    },
    {
      title: 'System Settings',
      description: 'Configure application preferences',
      icon: Settings,
      color: 'gray',
      items: ['General settings', 'Notification preferences', 'Data export options', 'Integration settings']
    },
    {
      title: 'Security',
      description: 'Security and access control settings',
      icon: Shield,
      color: 'red',
      items: ['Password policies', 'Two-factor authentication', 'Session management', 'Audit logs']
    },
  ]

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600',
      gray: 'bg-gray-100 text-gray-600',
      green: 'bg-green-100 text-green-600',
      red: 'bg-red-100 text-red-600',
    }
    return colors[color as keyof typeof colors] || colors.gray
  }

  const handleProductImportSuccess = () => {
    // Could refresh any product-related data here
  }
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Management</h1>
          <p className="text-gray-600">System administration and configuration</p>
        </div>
      </div>

      {/* Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {managementSections.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getColorClasses(section.color)}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                  <p className="text-sm text-gray-600">{section.description}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {section.items.map((item, index) => (
                  typeof item === 'object' ? (
                    <button
                      key={index}
                      onClick={item.action}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    </button>
                  ) : (
                    <button
                      key={index}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-700">{item}</span>
                    </button>
                  )
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* System Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="h-10 w-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Database className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
            <p className="text-sm text-gray-600">Current system health and statistics</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="h-3 w-3 bg-green-500 rounded-full mx-auto mb-2"></div>
            <p className="text-sm font-medium text-gray-900">Database</p>
            <p className="text-xs text-gray-600">Operational</p>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="h-3 w-3 bg-green-500 rounded-full mx-auto mb-2"></div>
            <p className="text-sm font-medium text-gray-900">API Services</p>
            <p className="text-xs text-gray-600">Operational</p>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="h-3 w-3 bg-green-500 rounded-full mx-auto mb-2"></div>
            <p className="text-sm font-medium text-gray-900">File Storage</p>
            <p className="text-xs text-gray-600">Operational</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">99.9%</p>
              <p className="text-sm text-gray-600">Uptime</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">156</p>
              <p className="text-sm text-gray-600">Active Users</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">2.3GB</p>
              <p className="text-sm text-gray-600">Storage Used</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">1,247</p>
              <p className="text-sm text-gray-600">API Calls Today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Product Import Modal */}
      {showProductImport && (
        <ProductImport
          onClose={() => setShowProductImport(false)}
          onSuccess={handleProductImportSuccess}
        />
      )}
    </div>
  )
}