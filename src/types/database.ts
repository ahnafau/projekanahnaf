export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: string
          created_at: string | null
        }
        Insert: {
          id?: string
          email: string
          name: string
          role: string
          created_at?: string | null
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: string
          created_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          sku_code: string
          product_name: string
          category: string
          unit_price: number
          image_url: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          sku_code: string
          product_name: string
          category: string
          unit_price: number
          image_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          sku_code?: string
          product_name?: string
          category?: string
          unit_price?: number
          image_url?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          id: string
          store_code: string
          store_name: string
          address: string
          gmaps_link: string | null
          route: string
          phone: string | null
          average_order_value: number | null
          order_frequency: string | null
          key_contact: string | null
          notes: string | null
          store_image_url: string | null
          created_by: string
          created_at: string | null
        }
        Insert: {
          id?: string
          store_code: string
          store_name: string
          address: string
          gmaps_link?: string | null
          route: string
          phone?: string | null
          average_order_value?: number | null
          order_frequency?: string | null
          key_contact?: string | null
          notes?: string | null
          store_image_url?: string | null
          created_by: string
          created_at?: string | null
        }
        Update: {
          id?: string
          store_code?: string
          store_name?: string
          address?: string
          gmaps_link?: string | null
          route?: string
          phone?: string | null
          average_order_value?: number | null
          order_frequency?: string | null
          key_contact?: string | null
          notes?: string | null
          store_image_url?: string | null
          created_by?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      visits: {
        Row: {
          id: string
          salesman_id: string
          store_id: string
          visit_date: string
          has_order: boolean | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          salesman_id: string
          store_id: string
          visit_date: string
          has_order?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          salesman_id?: string
          store_id?: string
          visit_date?: string
          has_order?: boolean | null
          notes?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_salesman_id_fkey"
            columns: ["salesman_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          }
        ]
      }
      visit_orders: {
        Row: {
          id: string
          visit_id: string
          product_id: string
          quantity: number
          unit_price: number
          discount_percentage: number | null
          line_total: number
        }
        Insert: {
          id?: string
          visit_id: string
          product_id: string
          quantity: number
          unit_price: number
          discount_percentage?: number | null
          line_total: number
        }
        Update: {
          id?: string
          visit_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          discount_percentage?: number | null
          line_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "visit_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_orders_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          }
        ]
      }
      promotions: {
        Row: {
          id: string
          product_id: string
          promo_name: string
          discount_percentage: number
          start_date: string
          end_date: string
          is_active: boolean | null
        }
        Insert: {
          id?: string
          product_id: string
          promo_name: string
          discount_percentage: number
          start_date: string
          end_date: string
          is_active?: boolean | null
        }
        Update: {
          id?: string
          product_id?: string
          promo_name?: string
          discount_percentage?: number
          start_date?: string
          end_date?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}