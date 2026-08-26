-- Jalankan di Supabase SQL Editor.
-- Tabel ini WAJIB dibuat supaya perubahan Bagan Akun (rename/tambah/hapus
-- akun di menu Bagan Akun) tersinkron ke server dan tidak hilang saat:
--  - dibuka dari perangkat/browser lain
--  - localStorage browser di-clear
--  - aplikasi melakukan sinkronisasi ulang (syncFromSupabase)
--
-- Sebelum tabel ini ada, edit Bagan Akun HANYA tersimpan di localStorage
-- browser yang dipakai saat itu — itulah sebab akun yang sudah di-rename
-- "tidak ke-update" kalau dicek dari device/browser lain.

create table if not exists custom_coa (
  id         int primary key default 1,
  data       jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  constraint custom_coa_singleton check (id = 1)
);

alter table custom_coa enable row level security;

-- Sesuaikan policy ini dengan pola RLS yang sudah dipakai tabel lain
-- (identitas, saldo_awal, jurnal, dst) di project Anda.
create policy "allow all on custom_coa" on custom_coa
  for all using (true) with check (true);

-- Supaya realtime subscription (postgres_changes) di aplikasi bisa
-- mendengar perubahan tabel ini dari device/user lain
alter publication supabase_realtime add table custom_coa;
