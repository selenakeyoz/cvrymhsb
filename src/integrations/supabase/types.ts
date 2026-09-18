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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      allowed_ips: {
        Row: {
          created_at: string
          id: string
          ip: string
          label: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip: string
          label?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string
          label?: string | null
        }
        Relationships: []
      }
      checks: {
        Row: {
          closed_at: string
          closed_by: string | null
          floor: number
          id: string
          note: string | null
          payment_method: string
          table_no: number
          total: number
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          floor: number
          id?: string
          note?: string | null
          payment_method?: string
          table_no: number
          total?: number
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          floor?: number
          id?: string
          note?: string | null
          payment_method?: string
          table_no?: number
          total?: number
        }
        Relationships: []
      }
      daily_closings: {
        Row: {
          check_count: number
          closing_date: string
          content: string | null
          created_at: string
          file_name: string | null
          id: string
          sync_error: string | null
          sync_status: string
          synced_at: string | null
          total: number
        }
        Insert: {
          check_count?: number
          closing_date: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          total?: number
        }
        Update: {
          check_count?: number
          closing_date?: string
          content?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          sync_error?: string | null
          sync_status?: string
          synced_at?: string | null
          total?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          check_id: string | null
          created_at: string
          created_by: string | null
          floor: number
          id: string
          item_name: string
          menu_item_id: string | null
          note: string | null
          quantity: number
          status: string
          table_no: number
          unit_price: number
        }
        Insert: {
          check_id?: string | null
          created_at?: string
          created_by?: string | null
          floor: number
          id?: string
          item_name: string
          menu_item_id?: string | null
          note?: string | null
          quantity?: number
          status?: string
          table_no: number
          unit_price?: number
        }
        Update: {
          check_id?: string | null
          created_at?: string
          created_by?: string | null
          floor?: number
          id?: string
          item_name?: string
          menu_item_id?: string | null
          note?: string | null
          quantity?: number
          status?: string
          table_no?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          username: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          username: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          username?: string
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "yonetici" | "garson" | "mutfak" | "muhasebe"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["yonetici", "garson", "mutfak", "muhasebe"],
    },
  },
} as const
