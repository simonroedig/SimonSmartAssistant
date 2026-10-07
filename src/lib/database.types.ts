export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
      notes: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          pinned: boolean;
          position: number;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          created_at?: string;
          id?: string;
          pinned?: boolean;
          position?: number;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          pinned?: boolean;
          position?: number;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
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
