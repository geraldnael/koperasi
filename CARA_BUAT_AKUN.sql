-- ═══════════════════════════════════════════════════════════════════════
-- CARA BUAT AKUN AWAL (admin, bendahara, ketua)
--
-- Aplikasi ini SENGAJA tidak punya halaman "Daftar" sendiri (self sign-up)
-- — akun cuma dibuat oleh pengurus lewat Supabase Dashboard. Ikuti urutan
-- di bawah untuk SETIAP akun yang mau dibuat.
-- ═══════════════════════════════════════════════════════════════════════

-- LANGKAH 1 (lewat Dashboard, BUKAN SQL Editor):
--   Buka Supabase Dashboard → Authentication → Users → tombol "Add user"
--   → "Create new user"
--   Isi email & password, CENTANG "Auto Confirm User" (supaya tidak perlu
--   verifikasi email dulu). Klik Create.
--   Setelah dibuat, klik user itu dan COPY "User UID"-nya (bentuknya UUID
--   panjang, misal: a1b2c3d4-....).

-- LANGKAH 2 (di SQL Editor): daftarkan role untuk user tadi.
-- Ganti 'PASTE-USER-UID-DISINI' dan nama/role sesuai user yang baru dibuat.
-- Ulangi baris insert ini untuk SETIAP akun (admin, bendahara, ketua).

insert into profiles (id, nama, role) values
  ('PASTE-USER-UID-ADMIN-DISINI',     'Nama Admin',      'admin'),
  ('PASTE-USER-UID-BENDAHARA-DISINI', 'Nama Bendahara',  'bendahara'),
  ('PASTE-USER-UID-KETUA-DISINI',     'Nama Ketua Umum', 'ketua')
on conflict (id) do update set nama = excluded.nama, role = excluded.role;

-- Cek hasilnya:
select id, nama, role from profiles;
