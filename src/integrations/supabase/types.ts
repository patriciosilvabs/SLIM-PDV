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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cash_movements: {
        Row: {
          amount: number
          cash_register_id: string
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          reason: string | null
        }
        Insert: {
          amount: number
          cash_register_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          reason?: string | null
        }
        Update: {
          amount?: number
          cash_register_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_registers: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          difference: number | null
          expected_amount: number | null
          id: string
          opened_at: string | null
          opened_by: string
          opening_amount: number
          status: Database["public"]["Enums"]["cash_register_status"] | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          opened_at?: string | null
          opened_by: string
          opening_amount?: number
          status?: Database["public"]["Enums"]["cash_register_status"] | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          difference?: number | null
          expected_amount?: number | null
          id?: string
          opened_at?: string | null
          opened_by?: string
          opening_amount?: number
          status?: Database["public"]["Enums"]["cash_register_status"] | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      combo_items: {
        Row: {
          combo_id: string
          id: string
          product_id: string
          quantity: number | null
          variation_id: string | null
        }
        Insert: {
          combo_id: string
          id?: string
          product_id: string
          quantity?: number | null
          variation_id?: string | null
        }
        Update: {
          combo_id?: string
          id?: string
          product_id?: string
          quantity?: number | null
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          combo_price: number
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          original_price: number
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          combo_price?: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          original_price?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          combo_price?: number
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          original_price?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      complement_group_options: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          option_id: string
          price_override: number | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          option_id: string
          price_override?: number | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          option_id?: string
          price_override?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "complement_group_options_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "complement_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complement_group_options_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "complement_options"
            referencedColumns: ["id"]
          },
        ]
      }
      complement_groups: {
        Row: {
          channels: string[] | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          name: string
          price_calculation_type: string | null
          selection_type: string
          sort_order: number | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          channels?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name: string
          price_calculation_type?: string | null
          selection_type?: string
          sort_order?: number | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          channels?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string
          price_calculation_type?: string | null
          selection_type?: string
          sort_order?: number | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      complement_options: {
        Row: {
          auto_calculate_cost: boolean | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          enable_stock_control: boolean | null
          id: string
          image_url: string | null
          internal_code: string | null
          is_active: boolean | null
          name: string
          pdv_code: string | null
          price: number
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          auto_calculate_cost?: boolean | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          enable_stock_control?: boolean | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_active?: boolean | null
          name: string
          pdv_code?: string | null
          price?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_calculate_cost?: boolean | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          enable_stock_control?: boolean | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_active?: boolean | null
          name?: string
          pdv_code?: string | null
          price?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_sounds: {
        Row: {
          created_at: string | null
          file_path: string
          id: string
          name: string
          sound_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          id?: string
          name: string
          sound_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          id?: string
          name?: string
          sound_type?: string
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          last_order_at: string | null
          name: string
          notes: string | null
          phone: string | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          last_order_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          last_order_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          cost_per_unit: number | null
          created_at: string | null
          current_stock: number | null
          id: string
          min_stock: number | null
          name: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          min_stock?: number | null
          name: string
          unit: string
          updated_at?: string | null
        }
        Update: {
          cost_per_unit?: number | null
          created_at?: string | null
          current_stock?: number | null
          id?: string
          min_stock?: number | null
          name?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      order_item_extras: {
        Row: {
          extra_id: string | null
          extra_name: string
          id: string
          order_item_id: string
          price: number
        }
        Insert: {
          extra_id?: string | null
          extra_name: string
          id?: string
          order_item_id: string
          price: number
        }
        Update: {
          extra_id?: string | null
          extra_name?: string
          id?: string
          order_item_id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_extras_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "product_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_extras_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_id: string
          product_id: string | null
          quantity: number
          status: Database["public"]["Enums"]["order_status"] | null
          total_price: number
          unit_price: number
          variation_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"] | null
          total_price: number
          unit_price: number
          variation_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["order_status"] | null
          total_price?: number
          unit_price?: number
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "product_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          discount: number | null
          id: string
          notes: string | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          status: Database["public"]["Enums"]["order_status"] | null
          subtotal: number | null
          table_id: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          order_type?: Database["public"]["Enums"]["order_type"] | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number | null
          table_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          order_type?: Database["public"]["Enums"]["order_type"] | null
          status?: Database["public"]["Enums"]["order_status"] | null
          subtotal?: number | null
          table_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cash_register_id: string | null
          created_at: string | null
          id: string
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          received_by: string | null
        }
        Insert: {
          amount: number
          cash_register_id?: string | null
          created_at?: string | null
          id?: string
          order_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          received_by?: string | null
        }
        Update: {
          amount?: number
          cash_register_id?: string | null
          created_at?: string | null
          id?: string
          order_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          received_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_complement_groups: {
        Row: {
          created_at: string | null
          group_id: string
          id: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          id?: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          id?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_complement_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "complement_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_complement_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_extra_links: {
        Row: {
          created_at: string | null
          extra_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string | null
          extra_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string | null
          extra_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_extra_links_extra_id_fkey"
            columns: ["extra_id"]
            isOneToOne: false
            referencedRelation: "product_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_extra_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_extras: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      product_ingredients: {
        Row: {
          id: string
          ingredient_id: string
          product_id: string
          quantity: number
        }
        Insert: {
          id?: string
          ingredient_id: string
          product_id: string
          quantity: number
        }
        Update: {
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variations: {
        Row: {
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price_modifier: number | null
          product_id: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_modifier?: number | null
          product_id: string
        }
        Update: {
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_modifier?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost_price: number | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          internal_code: string | null
          is_available: boolean | null
          is_featured: boolean | null
          is_promotion: boolean | null
          label: string | null
          name: string
          pdv_code: string | null
          preparation_time: number | null
          price: number
          promotion_price: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          is_promotion?: boolean | null
          label?: string | null
          name: string
          pdv_code?: string | null
          preparation_time?: number | null
          price: number
          promotion_price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          is_promotion?: boolean | null
          label?: string | null
          name?: string
          pdv_code?: string | null
          preparation_time?: number | null
          price?: number
          promotion_price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          id: string
          name: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          party_size: number | null
          reservation_date: string
          reservation_time: string
          status: string | null
          table_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          party_size?: number | null
          reservation_date: string
          reservation_time: string
          status?: string | null
          table_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          party_size?: number | null
          reservation_date?: string
          reservation_time?: string
          status?: string | null
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_announcements: {
        Row: {
          condition_comparison: string | null
          condition_threshold: number | null
          condition_type: string | null
          cooldown_minutes: number | null
          created_at: string | null
          created_by: string | null
          file_path: string
          id: string
          is_active: boolean | null
          last_played_at: string | null
          name: string
          schedule_type: string
          scheduled_date: string | null
          scheduled_days: number[] | null
          scheduled_time: string
          target_screens: string[] | null
          trigger_type: string
          volume: number | null
        }
        Insert: {
          condition_comparison?: string | null
          condition_threshold?: number | null
          condition_type?: string | null
          cooldown_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          file_path: string
          id?: string
          is_active?: boolean | null
          last_played_at?: string | null
          name: string
          schedule_type: string
          scheduled_date?: string | null
          scheduled_days?: number[] | null
          scheduled_time: string
          target_screens?: string[] | null
          trigger_type?: string
          volume?: number | null
        }
        Update: {
          condition_comparison?: string | null
          condition_threshold?: number | null
          condition_type?: string | null
          cooldown_minutes?: number | null
          created_at?: string | null
          created_by?: string | null
          file_path?: string
          id?: string
          is_active?: boolean | null
          last_played_at?: string | null
          name?: string
          schedule_type?: string
          scheduled_date?: string | null
          scheduled_days?: number[] | null
          scheduled_time?: string
          target_screens?: string[] | null
          trigger_type?: string
          volume?: number | null
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          ingredient_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          notes: string | null
          previous_stock: number
          quantity: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          ingredient_id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          new_stock: number
          notes?: string | null
          previous_stock: number
          quantity: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          ingredient_id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          new_stock?: number
          notes?: string | null
          previous_stock?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number | null
          created_at: string | null
          id: string
          number: number
          position_x: number | null
          position_y: number | null
          status: Database["public"]["Enums"]["table_status"] | null
        }
        Insert: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          number: number
          position_x?: number | null
          position_y?: number | null
          status?: Database["public"]["Enums"]["table_status"] | null
        }
        Update: {
          capacity?: number | null
          created_at?: string | null
          id?: string
          number?: number
          position_x?: number | null
          position_y?: number | null
          status?: Database["public"]["Enums"]["table_status"] | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      can_bootstrap_admin: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_employee: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "cashier" | "waiter" | "kitchen"
      cash_register_status: "open" | "closed"
      order_status:
        | "pending"
        | "preparing"
        | "ready"
        | "delivered"
        | "cancelled"
      order_type: "dine_in" | "takeaway" | "delivery"
      payment_method: "cash" | "credit_card" | "debit_card" | "pix"
      stock_movement_type: "entry" | "exit" | "adjustment"
      table_status: "available" | "occupied" | "reserved" | "bill_requested"
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
      app_role: ["admin", "cashier", "waiter", "kitchen"],
      cash_register_status: ["open", "closed"],
      order_status: ["pending", "preparing", "ready", "delivered", "cancelled"],
      order_type: ["dine_in", "takeaway", "delivery"],
      payment_method: ["cash", "credit_card", "debit_card", "pix"],
      stock_movement_type: ["entry", "exit", "adjustment"],
      table_status: ["available", "occupied", "reserved", "bill_requested"],
    },
  },
} as const
