export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      birthdays: {
        Row: {
          created_at: string;
          day: number;
          id: string;
          month: number;
          name: string;
          updated_at: string;
          user_id: string;
          year: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          day: number;
          id?: string;
          month: number;
          name: string;
          updated_at?: string;
          user_id?: string;
          year?: number | null;
        };
        Update: {
          created_at?: string;
          day?: number;
          id?: string;
          month?: number;
          name?: string;
          updated_at?: string;
          user_id?: string;
          year?: number | null;
        };
        Relationships: [];
      };
      blocked_apps: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          package: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          label?: string;
          package: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          package?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      day_notes: {
        Row: {
          day: string;
          focus: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          day: string;
          focus?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          day?: string;
          focus?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      note_categories: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          body: string;
          category_id: string | null;
          created_at: string;
          deleted_at: string | null;
          id: string;
          pinned: boolean;
          position: number;
          title: string | null;
          updated_at: string;
          user_id: string;
          vault: boolean;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          category_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          pinned?: boolean;
          position?: number;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
          vault?: boolean;
        };
        Update: {
          body?: string;
          category_id?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          pinned?: boolean;
          position?: number;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
          vault?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "notes_category_fk";
            columns: ["category_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "note_categories";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      plan_blocks: {
        Row: {
          color: string;
          created_at: string;
          day: string;
          done: boolean;
          end_min: number;
          icon: string | null;
          id: string;
          notes: string | null;
          start_min: number;
          title: string;
          todo_id: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          color?: string;
          created_at?: string;
          day: string;
          done?: boolean;
          end_min: number;
          icon?: string | null;
          id?: string;
          notes?: string | null;
          start_min: number;
          title: string;
          todo_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          day?: string;
          done?: boolean;
          end_min?: number;
          icon?: string | null;
          id?: string;
          notes?: string | null;
          start_min?: number;
          title?: string;
          todo_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_blocks_todo_fk";
            columns: ["todo_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "todos";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      shopping_history: {
        Row: {
          last_used_at: string;
          name: string;
          name_key: string;
          use_count: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          last_used_at?: string;
          name: string;
          name_key: string;
          use_count?: number;
          user_id?: string;
        };
        Update: {
          last_used_at?: string;
          name?: string;
          name_key?: string;
          use_count?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      shopping_items: {
        Row: {
          checked: boolean;
          checked_at: string | null;
          created_at: string;
          id: string;
          name: string;
          note: string | null;
          position: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          checked?: boolean;
          checked_at?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          note?: string | null;
          position?: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          checked?: boolean;
          checked_at?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          note?: string | null;
          position?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      todos: {
        Row: {
          created_at: string;
          done: boolean;
          done_at: string | null;
          due_date: string | null;
          id: string;
          notes: string | null;
          position: number;
          starred: boolean;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          position?: number;
          starred?: boolean;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          notes?: string | null;
          position?: number;
          starred?: boolean;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          location: Json | null;
          preferences: NonNullable<Json>;
          sleep_schedule: NonNullable<Json>;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          location?: Json | null;
          preferences?: NonNullable<Json>;
          sleep_schedule?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          location?: Json | null;
          preferences?: NonNullable<Json>;
          sleep_schedule?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      hook_before_user_created: { Args: { event: Json }; Returns: Json };
      keepalive: { Args: Record<PropertyKey, never>; Returns: boolean };
      move_note_to_vault: { Args: { new_position?: number; note_id: string }; Returns: boolean };
      vault_set_pin: { Args: { current_pin?: string; new_pin: string }; Returns: Json };
      vault_status: { Args: Record<PropertyKey, never>; Returns: Json };
      vault_unlock: { Args: { pin: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
