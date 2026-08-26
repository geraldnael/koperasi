-- Migration: tracking sinkronisasi dampak akun 2.1.12 ke Saldo Awal Jasa
-- Simpanan Sukarela.
--
-- Jalankan SEKALI di Supabase SQL Editor sebelum pakai fitur
-- "Sinkronkan Saldo Jasa dari Jurnal Lama".
--
-- Kenapa perlu: sebelum fitur ini dibuat, jurnal yang pakai akun 2.1.12
-- tidak otomatis mengubah SALDO AWAL JASA SIMPANAN SUKARELA anggota.
-- Kolom ini menandai jurnal mana yang dampaknya SUDAH diterapkan, supaya
-- proses sinkronisasi jurnal lama tidak menghitung dobel jurnal yang
-- baru dibuat/diedit (yang sudah otomatis ke-apply lewat aplikasi).

ALTER TABLE jurnal
  ADD COLUMN IF NOT EXISTS jasa_suk_synced boolean NOT NULL DEFAULT false;

-- Jurnal yang sudah ada sebelum migration ini otomatis jasa_suk_synced = false
-- (default di atas), sehingga akan muncul di preview "Sinkronkan Saldo Jasa
-- dari Jurnal Lama" kalau memang memakai akun 2.1.12.
