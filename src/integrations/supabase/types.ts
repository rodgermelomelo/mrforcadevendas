export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      approval_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: string | null
          id: string
          order_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          order_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          order_id: string
          reason: string | null
          required_authority: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          order_id: string
          reason?: string | null
          required_authority: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          order_id?: string
          reason?: string | null
          required_authority?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_rules: {
        Row: {
          active: boolean
          authority: Database["public"]["Enums"]["app_role"]
          created_at: string
          exception_type: string
          id: string
          max_amount: number | null
          max_percent: number | null
          min_amount: number | null
          min_percent: number | null
          price_table_code: string | null
          segment_code: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          authority: Database["public"]["Enums"]["app_role"]
          created_at?: string
          exception_type: string
          id?: string
          max_amount?: number | null
          max_percent?: number | null
          min_amount?: number | null
          min_percent?: number | null
          price_table_code?: string | null
          segment_code?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          authority?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          exception_type?: string
          id?: string
          max_amount?: number | null
          max_percent?: number | null
          min_amount?: number | null
          min_percent?: number | null
          price_table_code?: string | null
          segment_code?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          entity: string
          entity_id: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity: string
          entity_id?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          entity?: string
          entity_id?: string | null
          id?: string
        }
        Relationships: []
      }
      billing_methods: {
        Row: {
          code: string
          description: string
          id: string
        }
        Insert: {
          code: string
          description: string
          id?: string
        }
        Update: {
          code?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          active: boolean
          created_at: string | null
          metadata: Json | null
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          metadata?: Json | null
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          metadata?: Json | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      catalog_review: {
        Row: {
          classification: string
          created_at: string
          detail: string | null
          erp_code: string
          id: string
          reviewed_at: string | null
        }
        Insert: {
          classification: string
          created_at?: string
          detail?: string | null
          erp_code: string
          id?: string
          reviewed_at?: string | null
        }
        Update: {
          classification?: string
          created_at?: string
          detail?: string | null
          erp_code?: string
          id?: string
          reviewed_at?: string | null
        }
        Relationships: []
      }
      commercial_exceptions: {
        Row: {
          authority: Database["public"]["Enums"]["app_role"]
          created_at: string
          detail: string
          exception_type: string
          id: string
          label: string
          order_id: string
        }
        Insert: {
          authority: Database["public"]["Enums"]["app_role"]
          created_at?: string
          detail?: string
          exception_type: string
          id?: string
          label: string
          order_id: string
        }
        Update: {
          authority?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          detail?: string
          exception_type?: string
          id?: string
          label?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commercial_exceptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rule_sellers: {
        Row: {
          created_at: string
          id: string
          rule_id: string
          seller_erp_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          rule_id: string
          seller_erp_code: string
        }
        Update: {
          created_at?: string
          id?: string
          rule_id?: string
          seller_erp_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_rule_sellers_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "commission_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          active: boolean
          brand: string | null
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string
          percent: number
          priority: number
          product_erp_code: string | null
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string
          percent?: number
          priority?: number
          product_erp_code?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string
          percent?: number
          priority?: number
          product_erp_code?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      customer_financial_snapshots: {
        Row: {
          captured_at: string
          credit_limit: number
          customer_erp_code: string
          id: string
          open_balance: number
          overdue_balance: number
        }
        Insert: {
          captured_at?: string
          credit_limit?: number
          customer_erp_code: string
          id?: string
          open_balance?: number
          overdue_balance?: number
        }
        Update: {
          captured_at?: string
          credit_limit?: number
          customer_erp_code?: string
          id?: string
          open_balance?: number
          overdue_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "customer_financial_snapshots_customer_erp_code_fkey"
            columns: ["customer_erp_code"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["erp_code"]
          },
        ]
      }
      customer_seller_links: {
        Row: {
          active: boolean
          created_at: string
          customer_erp_code: string
          id: string
          payment_term: string
          price_table_code: string
          segment_code: string | null
          seller_erp_code: string
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          customer_erp_code: string
          id?: string
          payment_term?: string
          price_table_code?: string
          segment_code?: string | null
          seller_erp_code: string
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          customer_erp_code?: string
          id?: string
          payment_term?: string
          price_table_code?: string
          segment_code?: string | null
          seller_erp_code?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          active: boolean
          city: string
          created_at: string
          credit_limit: number
          erp_code: string
          id: string
          last_order_at: string | null
          legal_name: string
          min_order_value: number
          missing_since: string | null
          open_balance: number
          payment_term: string
          price_table_code: string
          restricted: boolean
          restriction_reason: string | null
          segment_code: string | null
          seller_erp_code: string
          tax_id: string
          trade_name: string
          uf: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          city?: string
          created_at?: string
          credit_limit?: number
          erp_code: string
          id?: string
          last_order_at?: string | null
          legal_name: string
          min_order_value?: number
          missing_since?: string | null
          open_balance?: number
          payment_term?: string
          price_table_code: string
          restricted?: boolean
          restriction_reason?: string | null
          segment_code?: string | null
          seller_erp_code: string
          tax_id: string
          trade_name: string
          uf?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          city?: string
          created_at?: string
          credit_limit?: number
          erp_code?: string
          id?: string
          last_order_at?: string | null
          legal_name?: string
          min_order_value?: number
          missing_since?: string | null
          open_balance?: number
          payment_term?: string
          price_table_code?: string
          restricted?: boolean
          restriction_reason?: string | null
          segment_code?: string | null
          seller_erp_code?: string
          tax_id?: string
          trade_name?: string
          uf?: string
          updated_at?: string
        }
        Relationships: []
      }
      erp_import_errors: {
        Row: {
          created_at: string
          id: string
          line_number: number | null
          message: string
          record_type: string | null
          run_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_number?: number | null
          message: string
          record_type?: string | null
          run_id: string
        }
        Update: {
          created_at?: string
          id?: string
          line_number?: number | null
          message?: string
          record_type?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_import_errors_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "erp_import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_import_runs: {
        Row: {
          created_by: string | null
          file_hash: string
          file_version: string | null
          finished_at: string | null
          id: string
          parser_version: string
          started_at: string
          status: string
          totals: Json
        }
        Insert: {
          created_by?: string | null
          file_hash: string
          file_version?: string | null
          finished_at?: string | null
          id?: string
          parser_version?: string
          started_at?: string
          status?: string
          totals?: Json
        }
        Update: {
          created_by?: string | null
          file_hash?: string
          file_version?: string | null
          finished_at?: string | null
          id?: string
          parser_version?: string
          started_at?: string
          status?: string
          totals?: Json
        }
        Relationships: []
      }
      erp_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          last_error: string | null
          order_id: string
          payload: Json | null
          state: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          last_error?: string | null
          order_id: string
          payload?: Json | null
          state?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          last_error?: string | null
          order_id?: string
          payload?: Json | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erp_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_sellers: {
        Row: {
          active: boolean
          created_at: string
          erp_code: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          erp_code: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          erp_code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      image_candidates: {
        Row: {
          confidence: string
          created_at: string
          domain: string
          id: string
          matched_code: string | null
          product_erp_code: string
          review_status: string
          source_url: string
          storage_path: string | null
        }
        Insert: {
          confidence?: string
          created_at?: string
          domain?: string
          id?: string
          matched_code?: string | null
          product_erp_code: string
          review_status?: string
          source_url: string
          storage_path?: string | null
        }
        Update: {
          confidence?: string
          created_at?: string
          domain?: string
          id?: string
          matched_code?: string | null
          product_erp_code?: string
          review_status?: string
          source_url?: string
          storage_path?: string | null
        }
        Relationships: []
      }
      inventory_snapshots: {
        Row: {
          captured_at: string
          id: string
          product_erp_code: string
          quantity: number
        }
        Insert: {
          captured_at?: string
          id?: string
          product_erp_code: string
          quantity?: number
        }
        Update: {
          captured_at?: string
          id?: string
          product_erp_code?: string
          quantity?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          commission_base: number
          commission_percent: number
          commission_rule_id: string | null
          commission_rule_name: string | null
          commission_scope: string
          commission_value: number
          discount_percent: number
          id: string
          order_id: string
          product_erp_code: string
          product_name: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          commission_base?: number
          commission_percent?: number
          commission_rule_id?: string | null
          commission_rule_name?: string | null
          commission_scope?: string
          commission_value?: number
          discount_percent?: number
          id?: string
          order_id: string
          product_erp_code: string
          product_name: string
          quantity: number
          total: number
          unit_price: number
        }
        Update: {
          commission_base?: number
          commission_percent?: number
          commission_rule_id?: string | null
          commission_rule_name?: string | null
          commission_scope?: string
          commission_value?: number
          discount_percent?: number
          id?: string
          order_id?: string
          product_erp_code?: string
          product_name?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_versions: {
        Row: {
          content_hash: string
          created_at: string
          id: string
          order_id: string
          revision: number
          snapshot: Json
        }
        Insert: {
          content_hash: string
          created_at?: string
          id?: string
          order_id: string
          revision?: number
          snapshot: Json
        }
        Update: {
          content_hash?: string
          created_at?: string
          id?: string
          order_id?: string
          revision?: number
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "order_versions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          commission_calculated_at: string | null
          commission_total: number
          confirmed_at: string | null
          content_hash: string
          created_at: string
          created_by: string
          customer_erp_code: string
          customer_name: string
          discount_total: number
          id: string
          integration_status: Database["public"]["Enums"]["integration_status"]
          is_bonus: boolean
          notes: string
          number: string
          order_discount_percent: number
          payment_term: string
          price_level_label: string
          price_table_code: string
          required_authority: Database["public"]["Enums"]["app_role"] | null
          seller_erp_code: string
          seller_name: string
          status: Database["public"]["Enums"]["commercial_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          commission_calculated_at?: string | null
          commission_total?: number
          confirmed_at?: string | null
          content_hash?: string
          created_at?: string
          created_by: string
          customer_erp_code: string
          customer_name: string
          discount_total?: number
          id?: string
          integration_status?: Database["public"]["Enums"]["integration_status"]
          is_bonus?: boolean
          notes?: string
          number?: string
          order_discount_percent?: number
          payment_term?: string
          price_level_label?: string
          price_table_code: string
          required_authority?: Database["public"]["Enums"]["app_role"] | null
          seller_erp_code: string
          seller_name: string
          status?: Database["public"]["Enums"]["commercial_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          commission_calculated_at?: string | null
          commission_total?: number
          confirmed_at?: string | null
          content_hash?: string
          created_at?: string
          created_by?: string
          customer_erp_code?: string
          customer_name?: string
          discount_total?: number
          id?: string
          integration_status?: Database["public"]["Enums"]["integration_status"]
          is_bonus?: boolean
          notes?: string
          number?: string
          order_discount_percent?: number
          payment_term?: string
          price_level_label?: string
          price_table_code?: string
          required_authority?: Database["public"]["Enums"]["app_role"] | null
          seller_erp_code?: string
          seller_name?: string
          status?: Database["public"]["Enums"]["commercial_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_erp_code_fkey"
            columns: ["customer_erp_code"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["erp_code"]
          },
        ]
      }
      payment_terms: {
        Row: {
          code: string
          description: string
          id: string
          is_standard: boolean
        }
        Insert: {
          code: string
          description: string
          id?: string
          is_standard?: boolean
        }
        Update: {
          code?: string
          description?: string
          id?: string
          is_standard?: boolean
        }
        Relationships: []
      }
      price_tables: {
        Row: {
          code: string
          id: string
          level_label: string | null
          mapped_level: number | null
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          id?: string
          level_label?: string | null
          mapped_level?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          id?: string
          level_label?: string | null
          mapped_level?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_eans: {
        Row: {
          ean: string
          id: string
          product_erp_code: string
        }
        Insert: {
          ean: string
          id?: string
          product_erp_code: string
        }
        Update: {
          ean?: string
          id?: string
          product_erp_code?: string
        }
        Relationships: []
      }
      product_enrichments: {
        Row: {
          description: string | null
          display_name: string | null
          id: string
          image_path: string | null
          image_url: string | null
          product_erp_code: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          display_name?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          product_erp_code: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          display_name?: string | null
          id?: string
          image_path?: string | null
          image_url?: string | null
          product_erp_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_groups: {
        Row: {
          code: string
          id: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_prices: {
        Row: {
          id: string
          price_table_code: string
          product_erp_code: string
          updated_at: string
          value_1: number
          value_2: number
          value_3: number
          value_4: number
          value_5: number
          value_6: number
        }
        Insert: {
          id?: string
          price_table_code: string
          product_erp_code: string
          updated_at?: string
          value_1?: number
          value_2?: number
          value_3?: number
          value_4?: number
          value_5?: number
          value_6?: number
        }
        Update: {
          id?: string
          price_table_code?: string
          product_erp_code?: string
          updated_at?: string
          value_1?: number
          value_2?: number
          value_3?: number
          value_4?: number
          value_5?: number
          value_6?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          brand: string | null
          category: string | null
          created_at: string
          erp_code: string
          group_code: string | null
          id: string
          is_launch: boolean
          missing_since: string | null
          name: string
          released: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          erp_code: string
          group_code?: string | null
          id?: string
          is_launch?: boolean
          missing_since?: string | null
          name: string
          released?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          category?: string | null
          created_at?: string
          erp_code?: string
          group_code?: string | null
          id?: string
          is_launch?: boolean
          missing_since?: string | null
          name?: string
          released?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      receivables: {
        Row: {
          amount: number
          customer_erp_code: string
          document: string
          due_date: string
          id: string
          paid: boolean
        }
        Insert: {
          amount: number
          customer_erp_code: string
          document: string
          due_date: string
          id?: string
          paid?: boolean
        }
        Update: {
          amount?: number
          customer_erp_code?: string
          document?: string
          due_date?: string
          id?: string
          paid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "receivables_customer_erp_code_fkey"
            columns: ["customer_erp_code"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["erp_code"]
          },
        ]
      }
      segments: {
        Row: {
          code: string
          id: string
          name: string
        }
        Insert: {
          code: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      seller_goals: {
        Row: {
          created_at: string | null
          id: string
          month: string
          seller_erp_code: string
          target_value: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          month: string
          seller_erp_code: string
          target_value?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          month?: string
          seller_erp_code?: string
          target_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_goals_seller_erp_code_fkey"
            columns: ["seller_erp_code"]
            isOneToOne: false
            referencedRelation: "erp_sellers"
            referencedColumns: ["erp_code"]
          },
        ]
      }
      team_visibility: {
        Row: {
          created_at: string
          id: string
          seller_erp_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          seller_erp_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          seller_erp_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_visibility_seller_erp_code_fkey"
            columns: ["seller_erp_code"]
            isOneToOne: false
            referencedRelation: "erp_sellers"
            referencedColumns: ["erp_code"]
          },
        ]
      }
      user_erp_seller_links: {
        Row: {
          created_at: string
          id: string
          seller_erp_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          seller_erp_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          seller_erp_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_erp_seller_links_seller_erp_code_fkey"
            columns: ["seller_erp_code"]
            isOneToOne: false
            referencedRelation: "erp_sellers"
            referencedColumns: ["erp_code"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_order_items: { Args: { _order_id: string }; Returns: boolean }
      can_read_order: { Args: { _order_id: string }; Returns: boolean }
      can_see_seller: {
        Args: { _code: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_approver: { Args: { _user_id: string }; Returns: boolean }
      is_ops: { Args: { _user_id: string }; Returns: boolean }
      visible_seller_codes: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role:
        | "vendedor_externo"
        | "vendedor_interno"
        | "supervisor"
        | "gerente_comercial"
        | "administrador"
        | "operador_integracao"
      commercial_status:
        | "draft"
        | "validating"
        | "pending_approval"
        | "changes_requested"
        | "rejected"
        | "auto_approved"
        | "approved"
        | "confirmed"
      integration_status:
        | "not_ready"
        | "awaiting_erp_integration"
        | "sending"
        | "accepted_by_erp"
        | "integration_error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "vendedor_externo",
        "vendedor_interno",
        "supervisor",
        "gerente_comercial",
        "administrador",
        "operador_integracao",
      ],
      commercial_status: [
        "draft",
        "validating",
        "pending_approval",
        "changes_requested",
        "rejected",
        "auto_approved",
        "approved",
        "confirmed",
      ],
      integration_status: [
        "not_ready",
        "awaiting_erp_integration",
        "sending",
        "accepted_by_erp",
        "integration_error",
      ],
    },
  },
} as const
