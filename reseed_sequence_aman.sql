-- Reseed sequence berdasarkan nomor JU-xxx TERTINGGI yang benar-benar ada
-- di tabel sekarang (lebih aman daripada berdasar count(*) saja, terutama
-- setelah proses renumber duplikat tadi yang bisa menghasilkan nomor baru
-- lebih tinggi dari jumlah baris keseluruhan).
select setval(
  'jurnal_nobukti_seq',
  (select coalesce(max((regexp_match(nobukti, '^JU-(\d+)$'))[1]::int), 0) from jurnal)
);

-- Cek hasilnya: pastikan angka ini >= nomor tertinggi yang kelihatan di tabel jurnal kamu
