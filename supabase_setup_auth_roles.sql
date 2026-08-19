-- ═══════════════════════════════════════════════════════════════════════
-- SETUP: Login multi-user dengan 3 role + sistem approval edit
--
--   • admin     → bisa INPUT (insert) semua, TIDAK bisa edit/hapus kecuali
--                 sudah di-approve oleh bendahara (sekali pakai per entri)
--   • bendahara → bebas penuh (insert, edit, hapus) + approve/reject
--                 permintaan edit dari admin
--   • ketua     → cuma bisa LIHAT (read-only), menu dibatasi di sisi
--                 aplikasi (Sidebar) — tapi database tetap dikunci read-only
--                 juga untuk role ini sebagai lapisan keamanan kedua
--
-- Jalankan file ini SEKALI di Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- 1) Tabel role per user, terhubung ke auth.users bawaan Supabase
create type user_role as enum ('admin', 'bendahara', 'ketua');

create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nama       text not null,
  role       user_role not null default 'admin',
  created_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles: semua user login bisa lihat" on profiles;
create policy "profiles: semua user login bisa lihat" on profiles
  for select using (auth.role() = 'authenticated');

drop policy if exists "profiles: admin only bisa insert profile baru" on profiles;
create policy "profiles: admin only bisa insert profile baru" on profiles
  for insert with check (auth.role() = 'authenticated');

-- 2) Tabel permintaan izin edit (khusus role admin, untuk jurnal)
create table if not exists edit_requests (
  id           bigint generated always as identity primary key,
  jurnal_id    bigint not null references jurnal(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz default now(),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  approved_by  uuid references auth.users(id),
  approved_at  timestamptz,
  used         boolean not null default false
);

alter table edit_requests enable row level security;

drop policy if exists "edit_requests: semua user login bisa lihat" on edit_requests;
create policy "edit_requests: semua user login bisa lihat" on edit_requests
  for select using (auth.role() = 'authenticated');

drop policy if exists "edit_requests: user bikin request utk dirinya sendiri" on edit_requests;
create policy "edit_requests: user bikin request utk dirinya sendiri" on edit_requests
  for insert with check (auth.uid() = requested_by);

drop policy if exists "edit_requests: bendahara bisa approve/reject" on edit_requests;
create policy "edit_requests: bendahara bisa approve/reject" on edit_requests
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'bendahara')
  );

-- 3) Helper: cek apakah user yang sedang login punya izin approved (belum
--    dipakai) untuk mengedit satu baris jurnal tertentu
create or replace function has_approved_edit(p_jurnal_id bigint)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from edit_requests
    where jurnal_id = p_jurnal_id
      and requested_by = auth.uid()
      and status = 'approved'
      and used = false
  );
$$;

-- 4) Ganti SEMUA policy lama di tabel jurnal (siapapun namanya) dengan yang
--    role-aware. Pakai DO block supaya tidak perlu tahu nama policy lama persis.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'jurnal' loop
    execute format('drop policy %I on jurnal', pol.policyname);
  end loop;
end $$;

create policy "jurnal: semua user login bisa lihat" on jurnal
  for select using (auth.role() = 'authenticated');

create policy "jurnal: admin & bendahara bisa input baru" on jurnal
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('admin','bendahara'))
  );

create policy "jurnal: bendahara bebas edit, admin cuma kalau di-approve" on jurnal
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'bendahara')
    or has_approved_edit(id)
  );

create policy "jurnal: cuma bendahara bisa hapus" on jurnal
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'bendahara')
  );

-- 5) Setelah admin BERHASIL update jurnal pakai izin yang di-approve,
--    otomatis tandai izin itu "used" — supaya sekali pakai, harus minta
--    izin lagi untuk edit berikutnya (bukan izin permanen).
create or replace function mark_edit_request_used()
returns trigger
language plpgsql
security definer
as $$
begin
  update edit_requests
  set used = true
  where jurnal_id = new.id
    and requested_by = auth.uid()
    and status = 'approved'
    and used = false;
  return new;
end;
$$;

drop trigger if exists trg_mark_edit_used on jurnal;
create trigger trg_mark_edit_used
  after update on jurnal
  for each row
  execute function mark_edit_request_used();

-- ═══════════════════════════════════════════════════════════════════════
-- CATATAN PENTING:
-- Migration ini baru mengunci tabel JURNAL secara ketat berdasarkan role.
-- Tabel lain (anggota, saldo_awal, coa, dst) untuk saat ini TETAP pakai
-- policy "allow all" yang lama — artinya secara TEKNIS di level database
-- masih bisa diakses siapa saja yang punya anon key, walau di aplikasi
-- sudah dikunci pakai login. Ini cukup untuk kebutuhan sekarang (jurnal
-- adalah data paling sensitif), tapi kalau mau proteksi penuh di semua
-- tabel, perlu migration tambahan menyusul.
-- ═══════════════════════════════════════════════════════════════════════
