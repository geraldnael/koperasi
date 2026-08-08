-- ═══════════════════════════════════════════════════════════════════════
-- FIX: No. Bukti jurnal double saat banyak user input barengan
-- Jalankan file ini SEKALI di Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Cari & tampilkan dulu nobukti yang sudah kembar (kalau ada dari sebelumnya)
--    Cek hasil query ini SEBELUM lanjut ke langkah 2 — kalau ada baris yang
--    muncul, perbaiki manual dulu (ubah salah satu nobukti-nya) di tabel jurnal,
--    karena UNIQUE CONSTRAINT di bawah akan GAGAL dibuat kalau masih ada duplikat.
select nobukti, count(*) as jumlah
from jurnal
group by nobukti
having count(*) > 1;

-- 2) Kunci nobukti supaya TIDAK BISA dobel lagi di level database
--    (baru jalankan setelah query di atas hasilnya KOSONG)
alter table jurnal
  add constraint jurnal_nobukti_unique unique (nobukti);

-- 3) Buat sequence untuk penomoran otomatis yang aman dipakai bersamaan
--    Diseed dari jumlah data yang sudah ada supaya lanjut nomornya, bukan mulai dari 1 lagi
create sequence if not exists jurnal_nobukti_seq;
select setval('jurnal_nobukti_seq', greatest((select count(*) from jurnal), 1));

-- 4) Fungsi RPC yang dipanggil dari aplikasi untuk minta nomor bukti berikutnya.
--    nextval() dijamin atomik oleh Postgres — dua user yang minta di detik yang
--    sama pun PASTI dapat angka berbeda.
create or replace function next_nobukti()
returns text
language sql
as $$
  select 'JU-' || lpad(nextval('jurnal_nobukti_seq')::text, 3, '0');
$$;

-- 5) Izinkan fungsi ini dipanggil dari aplikasi (anon + authenticated)
grant execute on function next_nobukti() to anon, authenticated;
