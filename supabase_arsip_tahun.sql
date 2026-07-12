-- Jalankan di Supabase SQL Editor (opsional, untuk sinkron arsip Tutup Buku
-- lintas perangkat). Kalau tabel ini TIDAK dibuat, fitur Tutup Buku &
-- Neraca Komparatif tetap jalan normal — arsip hanya tersimpan di
-- localStorage browser (device itu saja), tidak sinkron ke device lain.

create table if not exists arsip_tahun (
  tahun       text primary key,
  data        jsonb not null,
  updated_at  timestamptz default now()
);

alter table arsip_tahun enable row level security;

-- Sesuaikan policy ini dengan pola RLS yang sudah dipakai tabel lain
-- (identitas, saldo_awal, jurnal, dst) di project Anda.
create policy "allow all on arsip_tahun" on arsip_tahun
  for all using (true) with check (true);
