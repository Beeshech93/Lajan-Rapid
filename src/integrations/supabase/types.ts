export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      card_limits: {
        Row: {
          card_id: string;
          created_at: string;
          daily_limit: number;
          id: string;
          monthly_limit: number;
          online_enabled: boolean;
          per_transaction: number;
          updated_at: string;
        };
        Insert: {
          card_id: string;
          created_at?: string;
          daily_limit?: number;
          id?: string;
          monthly_limit?: number;
          online_enabled?: boolean;
          per_transaction?: number;
          updated_at?: string;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          daily_limit?: number;
          id?: string;
          monthly_limit?: number;
          online_enabled?: boolean;
          per_transaction?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_limits_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: true;
            referencedRelation: "virtual_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      card_transactions: {
        Row: {
          amount: number;
          card_id: string;
          created_at: string;
          currency: string;
          decline_reason: string | null;
          id: string;
          merchant: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          card_id: string;
          created_at?: string;
          currency: string;
          decline_reason?: string | null;
          id?: string;
          merchant: string;
          status?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          card_id?: string;
          created_at?: string;
          currency?: string;
          decline_reason?: string | null;
          id?: string;
          merchant?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_transactions_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "virtual_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      countries: {
        Row: {
          code: string;
          created_at: string;
          currency: string;
          flag: string;
          is_active: boolean;
          is_destination: boolean;
          is_origin: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          currency: string;
          flag?: string;
          is_active?: boolean;
          is_destination?: boolean;
          is_origin?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          currency?: string;
          flag?: string;
          is_active?: boolean;
          is_destination?: boolean;
          is_origin?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crypto_assets: {
        Row: {
          code: string;
          created_at: string;
          deposit_address: string;
          fee_percent: number;
          htg_rate: number;
          id: string;
          is_active: boolean;
          min_deposit: number;
          name: string;
          network: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          deposit_address?: string;
          fee_percent?: number;
          htg_rate?: number;
          id?: string;
          is_active?: boolean;
          min_deposit?: number;
          name: string;
          network: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          deposit_address?: string;
          fee_percent?: number;
          htg_rate?: number;
          id?: string;
          is_active?: boolean;
          min_deposit?: number;
          name?: string;
          network?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      crypto_deposits: {
        Row: {
          amount_crypto: number;
          amount_htg: number;
          asset_id: string;
          created_at: string;
          id: string;
          rate: number;
          reference: string;
          review_notes: string | null;
          reviewed_by: string | null;
          status: string;
          tx_hash: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_crypto: number;
          amount_htg?: number;
          asset_id: string;
          created_at?: string;
          id?: string;
          rate?: number;
          reference?: string;
          review_notes?: string | null;
          reviewed_by?: string | null;
          status?: string;
          tx_hash: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_crypto?: number;
          amount_htg?: number;
          asset_id?: string;
          created_at?: string;
          id?: string;
          rate?: number;
          reference?: string;
          review_notes?: string | null;
          reviewed_by?: string | null;
          status?: string;
          tx_hash?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crypto_deposits_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "crypto_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      crypto_withdrawals: {
        Row: {
          amount_crypto: number;
          amount_htg: number;
          asset_id: string | null;
          created_at: string;
          destination: string;
          id: string;
          kind: string;
          provider_ref: string | null;
          rate: number;
          reference: string;
          review_notes: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          amount_crypto?: number;
          amount_htg: number;
          asset_id?: string | null;
          created_at?: string;
          destination: string;
          id?: string;
          kind: string;
          provider_ref?: string | null;
          rate?: number;
          reference?: string;
          review_notes?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          amount_crypto?: number;
          amount_htg?: number;
          asset_id?: string | null;
          created_at?: string;
          destination?: string;
          id?: string;
          kind?: string;
          provider_ref?: string | null;
          rate?: number;
          reference?: string;
          review_notes?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "crypto_withdrawals_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "crypto_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      exchange_rates: {
        Row: {
          agent_commission_percent: number;
          created_at: string;
          fee_fixed: number;
          fee_percent: number;
          from_currency: string;
          id: string;
          is_active: boolean;
          rate: number;
          to_currency: string;
          updated_at: string;
        };
        Insert: {
          agent_commission_percent?: number;
          created_at?: string;
          fee_fixed?: number;
          fee_percent?: number;
          from_currency?: string;
          id?: string;
          is_active?: boolean;
          rate: number;
          to_currency?: string;
          updated_at?: string;
        };
        Update: {
          agent_commission_percent?: number;
          created_at?: string;
          fee_fixed?: number;
          fee_percent?: number;
          from_currency?: string;
          id?: string;
          is_active?: boolean;
          rate?: number;
          to_currency?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      integration_credentials: {
        Row: {
          name: string;
          updated_at: string;
          updated_by: string | null;
          value: string;
        };
        Insert: {
          name: string;
          updated_at?: string;
          updated_by?: string | null;
          value: string;
        };
        Update: {
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: string;
        };
        Relationships: [];
      };
      kyc_submissions: {
        Row: {
          address: string | null;
          birth_date: string | null;
          created_at: string;
          document_number: string;
          document_type: string;
          id: string;
          review_notes: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["kyc_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address?: string | null;
          birth_date?: string | null;
          created_at?: string;
          document_number: string;
          document_type: string;
          id?: string;
          review_notes?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["kyc_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address?: string | null;
          birth_date?: string | null;
          created_at?: string;
          document_number?: string;
          document_type?: string;
          id?: string;
          review_notes?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["kyc_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          country: string;
          created_at: string;
          full_name: string;
          id: string;
          kyc_status: Database["public"]["Enums"]["kyc_status"];
          language: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          country?: string;
          created_at?: string;
          full_name?: string;
          id: string;
          kyc_status?: Database["public"]["Enums"]["kyc_status"];
          language?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          country?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          kyc_status?: Database["public"]["Enums"]["kyc_status"];
          language?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      topups: {
        Row: {
          amount: number;
          country_code: string;
          created_at: string;
          currency: string;
          id: string;
          operator: string;
          origin_country: string;
          payment_method: string;
          phone: string;
          provider: string;
          provider_ref: string | null;
          reference: string;
          refunded: boolean;
          sku_code: string;
          status: string;
          status_detail: string | null;
          updated_at: string;
          user_id: string;
          wallet_id: string | null;
        };
        Insert: {
          amount: number;
          country_code?: string;
          created_at?: string;
          currency: string;
          id?: string;
          operator?: string;
          origin_country?: string;
          payment_method?: string;
          phone: string;
          provider?: string;
          provider_ref?: string | null;
          reference?: string;
          refunded?: boolean;
          sku_code: string;
          status?: string;
          status_detail?: string | null;
          updated_at?: string;
          user_id: string;
          wallet_id?: string | null;
        };
        Update: {
          amount?: number;
          country_code?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          operator?: string;
          origin_country?: string;
          payment_method?: string;
          phone?: string;
          provider?: string;
          provider_ref?: string | null;
          reference?: string;
          refunded?: boolean;
          sku_code?: string;
          status?: string;
          status_detail?: string | null;
          updated_at?: string;
          user_id?: string;
          wallet_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "topups_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      transfer_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          message: string | null;
          status: Database["public"]["Enums"]["transfer_status"];
          transfer_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          status: Database["public"]["Enums"]["transfer_status"];
          transfer_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          status?: Database["public"]["Enums"]["transfer_status"];
          transfer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transfer_events_transfer_id_fkey";
            columns: ["transfer_id"];
            isOneToOne: false;
            referencedRelation: "transfers";
            referencedColumns: ["id"];
          },
        ];
      };
      transfers: {
        Row: {
          agent_commission_send: number;
          agent_id: string | null;
          amount_receive: number;
          amount_send: number;
          created_at: string;
          delivery_method: string;
          destination_country: string;
          fee_send: number;
          id: string;
          note: string | null;
          origin_country: string;
          payment_method: string;
          rate: number;
          receive_currency: string;
          recipient_city: string;
          recipient_name: string;
          recipient_phone: string;
          reference: string;
          send_currency: string;
          status: Database["public"]["Enums"]["transfer_status"];
          total_send: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          agent_commission_send?: number;
          agent_id?: string | null;
          amount_receive?: number;
          amount_send: number;
          created_at?: string;
          delivery_method?: string;
          destination_country?: string;
          fee_send?: number;
          id?: string;
          note?: string | null;
          origin_country?: string;
          payment_method?: string;
          rate: number;
          receive_currency?: string;
          recipient_city: string;
          recipient_name: string;
          recipient_phone: string;
          reference?: string;
          send_currency?: string;
          status?: Database["public"]["Enums"]["transfer_status"];
          total_send?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agent_commission_send?: number;
          agent_id?: string | null;
          amount_receive?: number;
          amount_send?: number;
          created_at?: string;
          delivery_method?: string;
          destination_country?: string;
          fee_send?: number;
          id?: string;
          note?: string | null;
          origin_country?: string;
          payment_method?: string;
          rate?: number;
          receive_currency?: string;
          recipient_city?: string;
          recipient_name?: string;
          recipient_phone?: string;
          reference?: string;
          send_currency?: string;
          status?: Database["public"]["Enums"]["transfer_status"];
          total_send?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      virtual_cards: {
        Row: {
          brand: string;
          created_at: string;
          exp_month: number;
          exp_year: number;
          id: string;
          is_disposable: boolean;
          label: string | null;
          last4: string;
          provider: string;
          provider_card_id: string | null;
          status: string;
          updated_at: string;
          user_id: string;
          wallet_id: string;
        };
        Insert: {
          brand?: string;
          created_at?: string;
          exp_month: number;
          exp_year: number;
          id?: string;
          is_disposable?: boolean;
          label?: string | null;
          last4: string;
          provider?: string;
          provider_card_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id: string;
          wallet_id: string;
        };
        Update: {
          brand?: string;
          created_at?: string;
          exp_month?: number;
          exp_year?: number;
          id?: string;
          is_disposable?: boolean;
          label?: string | null;
          last4?: string;
          provider?: string;
          provider_card_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string;
          wallet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "virtual_cards_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      wallet_transactions: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          kind: string;
          user_id: string;
          wallet_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency: string;
          description?: string | null;
          id?: string;
          kind: string;
          user_id: string;
          wallet_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          kind?: string;
          user_id?: string;
          wallet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          balance: number;
          created_at: string;
          currency: string;
          id: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          status?: string;
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
      admin_adjust_wallet: {
        Args: { _amount: number; _description?: string; _wallet_id: string };
        Returns: number;
      };
      approve_crypto_deposit: {
        Args: { _approve: boolean; _deposit_id: string; _notes?: string };
        Returns: boolean;
      };
      card_purchase: {
        Args: { _amount: number; _card_id: string; _merchant: string };
        Returns: string;
      };
      convert_wallet: {
        Args: { _amount: number; _from_wallet: string; _to_currency: string };
        Returns: boolean;
      };
      create_topup: {
        Args: {
          _amount: number;
          _country_code: string;
          _operator: string;
          _phone: string;
          _sku_code: string;
          _wallet_id: string;
        };
        Returns: {
          amount: number;
          country_code: string;
          created_at: string;
          currency: string;
          id: string;
          operator: string;
          origin_country: string;
          payment_method: string;
          phone: string;
          provider: string;
          provider_ref: string | null;
          reference: string;
          refunded: boolean;
          sku_code: string;
          status: string;
          status_detail: string | null;
          updated_at: string;
          user_id: string;
          wallet_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "topups";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_topup_direct: {
        Args: {
          _amount: number;
          _country_code: string;
          _currency: string;
          _operator: string;
          _phone: string;
          _sku_code: string;
        };
        Returns: {
          amount: number;
          country_code: string;
          created_at: string;
          currency: string;
          id: string;
          operator: string;
          origin_country: string;
          payment_method: string;
          phone: string;
          provider: string;
          provider_ref: string | null;
          reference: string;
          refunded: boolean;
          sku_code: string;
          status: string;
          status_detail: string | null;
          updated_at: string;
          user_id: string;
          wallet_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "topups";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_topup_pending: {
        Args: {
          _amount: number;
          _country_code: string;
          _currency: string;
          _operator: string;
          _origin_country: string;
          _payment_method: string;
          _phone: string;
          _sku_code: string;
        };
        Returns: {
          amount: number;
          country_code: string;
          created_at: string;
          currency: string;
          id: string;
          operator: string;
          origin_country: string;
          payment_method: string;
          phone: string;
          provider: string;
          provider_ref: string | null;
          reference: string;
          refunded: boolean;
          sku_code: string;
          status: string;
          status_detail: string | null;
          updated_at: string;
          user_id: string;
          wallet_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "topups";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ensure_wallet: { Args: { _currency: string }; Returns: string };
      find_user_by_phone: {
        Args: { _phone: string };
        Returns: {
          full_name: string;
          user_id: string;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_staff: { Args: { _user_id: string }; Returns: boolean };
      issue_virtual_card: {
        Args: {
          _brand?: string;
          _disposable?: boolean;
          _label?: string;
          _wallet_id: string;
        };
        Returns: string;
      };
      p2p_send: {
        Args: {
          _amount: number;
          _from_wallet: string;
          _note?: string;
          _phone: string;
        };
        Returns: Json;
      };
      request_crypto_withdrawal: {
        Args: {
          _amount_htg: number;
          _asset_id?: string;
          _destination: string;
          _kind: string;
        };
        Returns: {
          amount_crypto: number;
          amount_htg: number;
          asset_id: string | null;
          created_at: string;
          destination: string;
          id: string;
          kind: string;
          provider_ref: string | null;
          rate: number;
          reference: string;
          review_notes: string | null;
          status: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "crypto_withdrawals";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_card_status: {
        Args: { _card_id: string; _status: string };
        Returns: boolean;
      };
      set_user_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      settle_crypto_withdrawal: {
        Args: {
          _id: string;
          _notes?: string;
          _provider_ref?: string;
          _status: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "client" | "agent" | "admin";
      kyc_status: "none" | "pending" | "approved" | "rejected";
      transfer_status:
        | "created"
        | "awaiting_payment"
        | "paid"
        | "processing"
        | "ready_for_pickup"
        | "completed"
        | "cancelled";
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
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
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
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["client", "agent", "admin"],
      kyc_status: ["none", "pending", "approved", "rejected"],
      transfer_status: [
        "created",
        "awaiting_payment",
        "paid",
        "processing",
        "ready_for_pickup",
        "completed",
        "cancelled",
      ],
    },
  },
} as const;
