-- Ganti nomor bukti pada baris DUPLIKAT (yang lebih baru / id lebih besar).
-- Baris yang paling lama (id terkecil) di tiap nomor dobel TETAP pakai nomor aslinya,
-- tidak ada data yang dihapus, hanya nobukti-nya diganti dengan nomor baru yang unik.
with ranked as (
  select id, nobukti,
         row_number() over (partition by nobukti order by id) as rn
  from jurnal
),
extras as (
  select id, nobukti,
         row_number() over (order by id) as extra_seq
  from ranked
  where rn > 1
),
maxnum as (
  select coalesce(max((regexp_match(nobukti, '^JU-(\d+)$'))[1]::int), 0) as maxn
  from jurnal
)
update jurnal j
set nobukti = 'JU-' || lpad((maxnum.maxn + extras.extra_seq)::text, 3, '0')
from extras, maxnum
where j.id = extras.id;

-- Cek ulang, harusnya sekarang hasilnya KOSONG
select nobukti, count(*) from jurnal group by nobukti having count(*) > 1;
