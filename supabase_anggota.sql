-- Jalankan di Supabase SQL Editor.
-- Tabel ini WAJIB dibuat supaya Data Anggota (Tambah/Edit/Hapus di menu
-- Data Anggota) tersinkron ke server dan tidak hilang saat:
--  - dibuka dari perangkat/browser lain
--  - localStorage browser di-clear
--  - aplikasi melakukan sinkronisasi ulang (syncFromSupabase)
--
-- Sebelum tabel ini ada, penambahan anggota HANYA tersimpan di localStorage
-- browser yang dipakai saat itu — itulah sebab anggota baru "hilang besoknya"
-- kalau diakses dari device/browser lain.

create table if not exists anggota (
  id          bigint primary key,
  no_anggota  text,
  nama        text not null,
  alamat      text default '',
  telepon     text default '',
  email       text default '',
  updated_at  timestamptz default now()
);

alter table anggota enable row level security;

-- Sesuaikan policy ini dengan pola RLS yang sudah dipakai tabel lain
-- (identitas, saldo_awal, jurnal, dst) di project Anda.
create policy "allow all on anggota" on anggota
  for all using (true) with check (true);

-- Catatan: setelah tabel ini dibuat, aplikasi akan OTOMATIS mengisi 484 nama
-- anggota awal ke tabel ini saat pertama kali online (sekali saja, hanya
-- jika tabel masih kosong) — tidak perlu input manual satu per satu.
