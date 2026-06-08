// Auto-generated types — หรือรัน: npx supabase gen types typescript --project-id YOUR_ID > src/lib/database.types.ts

export type ProxyType = 'phone' | 'national_id' | 'bank_account'

export interface Database {
  public: {
    Tables: {
      qr_payments: {
        Row: {
          id: string
          proxy_type: ProxyType
          proxy_value: string
          bank_code: string | null
          bank_name: string | null
          amount: number | null
          recipient_name: string | null
          qr_payload: string
          scan_count: number
          created_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          id?: string
          proxy_type: ProxyType
          proxy_value: string
          bank_code?: string | null
          bank_name?: string | null
          amount?: number | null
          recipient_name?: string | null
          qr_payload: string
          scan_count?: number
          created_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['qr_payments']['Insert']>
      }
      qr_scan_logs: {
        Row: {
          id: string
          payment_id: string | null
          scanned_at: string
          user_agent: string | null
          ip_address: string | null
        }
        Insert: {
          id?: string
          payment_id?: string | null
          scanned_at?: string
          user_agent?: string | null
          ip_address?: string | null
        }
        Update: never
      }
    }
    Functions: {
      increment_scan_count: { Args: { payment_id: string }; Returns: void }
    }
  }
}

// Convenience type
export type QrPayment = Database['public']['Tables']['qr_payments']['Row']
export type QrPaymentInsert = Database['public']['Tables']['qr_payments']['Insert']
