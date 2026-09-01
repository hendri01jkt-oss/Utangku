// File ini DIHASILKAN OTOMATIS dari skema Supabase — jangan diubah manual.
// Perbarui dengan MCP `generate_typescript_types` setiap kali ada migrasi baru.

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
      payment_orders: {
        Row: {
          amount: number
          created_at: string
          midtrans_transaction_id: string | null
          order_id: string
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
          warung_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          midtrans_transaction_id?: string | null
          order_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          warung_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          midtrans_transaction_id?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
          warung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "v_ringkasan_warung"
            referencedColumns: ["warung_id"]
          },
          {
            foreignKeyName: "payment_orders_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "warung"
            referencedColumns: ["id"]
          },
        ]
      }
      pelanggan: {
        Row: {
          alamat: string | null
          catatan: string | null
          created_at: string
          deleted_at: string | null
          foto_path: string | null
          id: string
          nama: string
          no_wa: string | null
          status: Database["public"]["Enums"]["pelanggan_status"]
          terakhir_dilihat_pelanggan: string | null
          token_pantau: string
          updated_at: string
          warung_id: string
        }
        Insert: {
          alamat?: string | null
          catatan?: string | null
          created_at?: string
          deleted_at?: string | null
          foto_path?: string | null
          id?: string
          nama: string
          no_wa?: string | null
          status?: Database["public"]["Enums"]["pelanggan_status"]
          terakhir_dilihat_pelanggan?: string | null
          token_pantau?: string
          updated_at?: string
          warung_id: string
        }
        Update: {
          alamat?: string | null
          catatan?: string | null
          created_at?: string
          deleted_at?: string | null
          foto_path?: string | null
          id?: string
          nama?: string
          no_wa?: string | null
          status?: Database["public"]["Enums"]["pelanggan_status"]
          terakhir_dilihat_pelanggan?: string | null
          token_pantau?: string
          updated_at?: string
          warung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pelanggan_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "v_ringkasan_warung"
            referencedColumns: ["warung_id"]
          },
          {
            foreignKeyName: "pelanggan_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "warung"
            referencedColumns: ["id"]
          },
        ]
      }
      pembayaran: {
        Row: {
          catatan: string | null
          created_at: string
          deleted_at: string | null
          dibuat_oleh: string | null
          id: string
          metode: Database["public"]["Enums"]["metode_bayar"]
          nominal: number
          pelanggan_id: string
          tanggal: string
          transaksi_id: string
          updated_at: string
          warung_id: string
        }
        Insert: {
          catatan?: string | null
          created_at?: string
          deleted_at?: string | null
          dibuat_oleh?: string | null
          id?: string
          metode?: Database["public"]["Enums"]["metode_bayar"]
          nominal: number
          pelanggan_id: string
          tanggal?: string
          transaksi_id: string
          updated_at?: string
          warung_id: string
        }
        Update: {
          catatan?: string | null
          created_at?: string
          deleted_at?: string | null
          dibuat_oleh?: string | null
          id?: string
          metode?: Database["public"]["Enums"]["metode_bayar"]
          nominal?: number
          pelanggan_id?: string
          tanggal?: string
          transaksi_id?: string
          updated_at?: string
          warung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pembayaran_pelanggan_id_fkey"
            columns: ["pelanggan_id"]
            isOneToOne: false
            referencedRelation: "pelanggan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembayaran_pelanggan_id_fkey"
            columns: ["pelanggan_id"]
            isOneToOne: false
            referencedRelation: "v_ringkasan_pelanggan"
            referencedColumns: ["pelanggan_id"]
          },
          {
            foreignKeyName: "pembayaran_transaksi_id_fkey"
            columns: ["transaksi_id"]
            isOneToOne: false
            referencedRelation: "transaksi_utang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembayaran_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "v_ringkasan_warung"
            referencedColumns: ["warung_id"]
          },
          {
            foreignKeyName: "pembayaran_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "warung"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nama_lengkap: string | null
          no_wa: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          nama_lengkap?: string | null
          no_wa?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nama_lengkap?: string | null
          no_wa?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          payment_provider: string | null
          payment_reference: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          tanggal_expired: string | null
          tanggal_mulai_langganan: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          warung_id: string
        }
        Insert: {
          payment_provider?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tanggal_expired?: string | null
          tanggal_mulai_langganan?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          warung_id: string
        }
        Update: {
          payment_provider?: string | null
          payment_reference?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          tanggal_expired?: string | null
          tanggal_mulai_langganan?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          warung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: true
            referencedRelation: "v_ringkasan_warung"
            referencedColumns: ["warung_id"]
          },
          {
            foreignKeyName: "subscriptions_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: true
            referencedRelation: "warung"
            referencedColumns: ["id"]
          },
        ]
      }
      transaksi_item: {
        Row: {
          created_at: string
          deleted_at: string | null
          harga_satuan: number
          id: string
          nama_item: string
          qty: number
          subtotal: number
          transaksi_id: string
          updated_at: string
          urutan: number
          warung_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          harga_satuan: number
          id?: string
          nama_item: string
          qty: number
          subtotal?: never
          transaksi_id: string
          updated_at?: string
          urutan?: number
          warung_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          harga_satuan?: number
          id?: string
          nama_item?: string
          qty?: number
          subtotal?: never
          transaksi_id?: string
          updated_at?: string
          urutan?: number
          warung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaksi_item_transaksi_id_fkey"
            columns: ["transaksi_id"]
            isOneToOne: false
            referencedRelation: "transaksi_utang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaksi_item_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "warung"
            referencedColumns: ["id"]
          },
        ]
      }
      transaksi_utang: {
        Row: {
          created_at: string
          deleted_at: string | null
          dibuat_oleh: string | null
          id: string
          jatuh_tempo: string | null
          jenis: Database["public"]["Enums"]["jenis_transaksi"]
          keterangan: string | null
          nominal: number
          pelanggan_id: string | null
          reminder_hari_sebelum: number
          reminder_terkirim_untuk: string | null
          status: Database["public"]["Enums"]["utang_status"]
          tanggal: string
          total_dibayar: number
          updated_at: string
          warung_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          dibuat_oleh?: string | null
          id?: string
          jatuh_tempo?: string | null
          jenis?: Database["public"]["Enums"]["jenis_transaksi"]
          keterangan?: string | null
          nominal: number
          pelanggan_id?: string | null
          reminder_hari_sebelum?: number
          reminder_terkirim_untuk?: string | null
          status?: Database["public"]["Enums"]["utang_status"]
          tanggal?: string
          total_dibayar?: number
          updated_at?: string
          warung_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          dibuat_oleh?: string | null
          id?: string
          jatuh_tempo?: string | null
          jenis?: Database["public"]["Enums"]["jenis_transaksi"]
          keterangan?: string | null
          nominal?: number
          pelanggan_id?: string | null
          reminder_hari_sebelum?: number
          reminder_terkirim_untuk?: string | null
          status?: Database["public"]["Enums"]["utang_status"]
          tanggal?: string
          total_dibayar?: number
          updated_at?: string
          warung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaksi_utang_pelanggan_id_fkey"
            columns: ["pelanggan_id"]
            isOneToOne: false
            referencedRelation: "pelanggan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaksi_utang_pelanggan_id_fkey"
            columns: ["pelanggan_id"]
            isOneToOne: false
            referencedRelation: "v_ringkasan_pelanggan"
            referencedColumns: ["pelanggan_id"]
          },
          {
            foreignKeyName: "transaksi_utang_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "v_ringkasan_warung"
            referencedColumns: ["warung_id"]
          },
          {
            foreignKeyName: "transaksi_utang_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "warung"
            referencedColumns: ["id"]
          },
        ]
      }
      warung: {
        Row: {
          alamat: string | null
          created_at: string
          id: string
          lebar_struk: number
          logo_path: string | null
          nama_warung: string
          no_wa_warung: string | null
          pemilik_id: string
          template_pesan_tagihan: string
          tempo_default_hari: number
          updated_at: string
        }
        Insert: {
          alamat?: string | null
          created_at?: string
          id?: string
          lebar_struk?: number
          logo_path?: string | null
          nama_warung: string
          no_wa_warung?: string | null
          pemilik_id: string
          template_pesan_tagihan?: string
          tempo_default_hari?: number
          updated_at?: string
        }
        Update: {
          alamat?: string | null
          created_at?: string
          id?: string
          lebar_struk?: number
          logo_path?: string | null
          nama_warung?: string
          no_wa_warung?: string | null
          pemilik_id?: string
          template_pesan_tagihan?: string
          tempo_default_hari?: number
          updated_at?: string
        }
        Relationships: []
      }
      warung_anggota: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["warung_role"]
          user_id: string
          warung_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["warung_role"]
          user_id: string
          warung_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["warung_role"]
          user_id?: string
          warung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warung_anggota_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "v_ringkasan_warung"
            referencedColumns: ["warung_id"]
          },
          {
            foreignKeyName: "warung_anggota_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "warung"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_ringkasan_pelanggan: {
        Row: {
          foto_path: string | null
          jatuh_tempo_terdekat: string | null
          jumlah_transaksi_aktif: number | null
          nama: string | null
          no_wa: string | null
          pelanggan_id: string | null
          sisa_utang: number | null
          status: Database["public"]["Enums"]["pelanggan_status"] | null
          tanggal_utang_terlama: string | null
          total_dibayar: number | null
          total_utang: number | null
          warung_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pelanggan_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "v_ringkasan_warung"
            referencedColumns: ["warung_id"]
          },
          {
            foreignKeyName: "pelanggan_warung_id_fkey"
            columns: ["warung_id"]
            isOneToOne: false
            referencedRelation: "warung"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ringkasan_warung: {
        Row: {
          jumlah_jatuh_tempo_3_hari: number | null
          jumlah_lewat_tempo: number | null
          jumlah_pelanggan_berutang: number | null
          tertagih_bulan_ini: number | null
          total_piutang: number | null
          warung_id: string | null
        }
        Insert: {
          jumlah_jatuh_tempo_3_hari?: never
          jumlah_lewat_tempo?: never
          jumlah_pelanggan_berutang?: never
          tertagih_bulan_ini?: never
          total_piutang?: never
          warung_id?: string | null
        }
        Update: {
          jumlah_jatuh_tempo_3_hari?: never
          jumlah_lewat_tempo?: never
          jumlah_pelanggan_berutang?: never
          tertagih_bulan_ini?: never
          total_piutang?: never
          warung_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      buat_warung: {
        Args: {
          p_alamat?: string
          p_nama_warung: string
          p_no_wa?: string
          p_tempo_default_hari?: number
        }
        Returns: {
          alamat: string | null
          created_at: string
          id: string
          lebar_struk: number
          logo_path: string | null
          nama_warung: string
          no_wa_warung: string | null
          pemilik_id: string
          template_pesan_tagihan: string
          tempo_default_hari: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "warung"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      hari_ini: { Args: never; Returns: string }
      pantau_utang: { Args: { p_token: string }; Returns: Json }
      hitung_ulang_utang: { Args: { p_transaksi: string }; Returns: undefined }
      warung_saya: { Args: never; Returns: string[] }
    }
    Enums: {
      jenis_transaksi: "utang" | "tunai"
      metode_bayar: "tunai" | "transfer" | "qris" | "lainnya"
      payment_status: "pending" | "settlement" | "expired" | "failed"
      pelanggan_status: "aktif" | "nonaktif"
      subscription_status: "active" | "expired" | "cancelled"
      subscription_tier: "free" | "pro"
      utang_status: "belum_lunas" | "sebagian" | "lunas"
      warung_role: "pemilik" | "kasir"
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
      jenis_transaksi: ["utang", "tunai"],
      metode_bayar: ["tunai", "transfer", "qris", "lainnya"],
      payment_status: ["pending", "settlement", "expired", "failed"],
      pelanggan_status: ["aktif", "nonaktif"],
      subscription_status: ["active", "expired", "cancelled"],
      subscription_tier: ["free", "pro"],
      utang_status: ["belum_lunas", "sebagian", "lunas"],
      warung_role: ["pemilik", "kasir"],
    },
  },
} as const
