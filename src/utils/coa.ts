import type { Akun } from '../types'

export const COA: Akun[] = [
  // ══ ASET LANCAR ══
  { kode:'1.1.1',  nama:'Kas',                              kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  { kode:'1.1.2',  nama:'Bank',                             kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  { kode:'1.1.3',  nama:'Surat Berharga',                   kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  { kode:'1.1.4',  nama:'Piutang Simpan Pinjam',            kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  { kode:'1.1.5',  nama:'Piutang Jasa Pinjaman',            kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  { kode:'1.1.6',  nama:'Piutang Toko',                     kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  { kode:'1.1.7',  nama:'Penyisihan Piutang Tak Tertagih',  kelompok:'Aset Lancar',     grup:'ASET',      tipe:'K' },
  { kode:'1.1.8',  nama:'Persediaan Barang',                kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  { kode:'1.1.9',  nama:'Persediaan Lain-lain',             kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  { kode:'1.1.10', nama:'Biaya dibayar dimuka',             kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  { kode:'1.1.11', nama:'Pendapatan diterima dimuka',       kelompok:'Aset Lancar',     grup:'ASET',      tipe:'K' },
  { kode:'1.1.12', nama:'Aset lancar lainnya',              kelompok:'Aset Lancar',     grup:'ASET',      tipe:'D' },
  // ══ ASET TIDAK LANCAR ══
  { kode:'1.2.1',  nama:'Penyertaan di PKPRI',              kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.2',  nama:'Tabungan di PKPRI',                kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.3',  nama:'Simpanan Berjangka',               kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.4',  nama:'SKPB di PKPRI',                    kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.5',  nama:'Simpanan di koperasi sekunder',    kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.6',  nama:'Properti investasi',               kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.7',  nama:'Tanah',                            kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.8',  nama:'Gedung Dan Bangunan',              kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.9',  nama:'Mesin dan kendaraan',              kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.10', nama:'Inventaris',                       kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'D' },
  { kode:'1.2.11', nama:'Akm. Penyusutan Gedung Dan Bangunan', kelompok:'Aset Tidak Lancar', grup:'ASET', tipe:'K' },
  { kode:'1.2.12', nama:'Akm. Penyusutan Mesin dan Kendaraan', kelompok:'Aset Tidak Lancar', grup:'ASET', tipe:'K' },
  { kode:'1.2.13', nama:'Akm. Penyusutan Inventaris',       kelompok:'Aset Tidak Lancar', grup:'ASET',    tipe:'K' },
  // ══ KEWAJIBAN JANGKA PENDEK ══
  { kode:'2.1.1',  nama:'Utang Usaha',                      kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.2',  nama:'Dana SHU Anggota (Jasa Simpanan)', kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.3',  nama:'Dana SHU Anggota (Jasa Pinjaman)', kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.4',  nama:'Dana Penyertaan dan Kewajiban',    kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.5',  nama:'Dana Pendidikan',                  kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.6',  nama:'Dana Karyawan',                    kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.7',  nama:'Dana Sosial',                      kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.8',  nama:'Dana PDK',                         kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.9',  nama:'Simpanan Sukarela',                kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.10', nama:'Simpanan Wajib Khusus',            kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.11', nama:'Simpanan lain-lain',               kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.12', nama:'Biaya ymh dibayar',                kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.13', nama:'Dana Asuransi',                    kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.1.14', nama:'Tabungan Hari Tua',                kelompok:'Kewajiban Jk. Pendek', grup:'KEWAJIBAN', tipe:'K' },
  // ══ KEWAJIBAN JANGKA PANJANG ══
  { kode:'2.2.1',  nama:'Utang Pajak',                      kelompok:'Kewajiban Jk. Panjang', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.2.2',  nama:'Cadangan Risiko',                  kelompok:'Kewajiban Jk. Panjang', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.2.3',  nama:'Simpanan berjangka',               kelompok:'Kewajiban Jk. Panjang', grup:'KEWAJIBAN', tipe:'K' },
  { kode:'2.2.4',  nama:'Penyertaan modal',                 kelompok:'Kewajiban Jk. Panjang', grup:'KEWAJIBAN', tipe:'K' },
  // ══ EKUITAS ══
  { kode:'3.1.1',  nama:'Simpanan Pokok',                   kelompok:'Ekuitas', grup:'EKUITAS', tipe:'K' },
  { kode:'3.1.2',  nama:'Simpanan Wajib',                   kelompok:'Ekuitas', grup:'EKUITAS', tipe:'K' },
  { kode:'3.1.3',  nama:'Hibah/ Donasi',                    kelompok:'Ekuitas', grup:'EKUITAS', tipe:'K' },
  { kode:'3.1.4',  nama:'Cadangan',                         kelompok:'Ekuitas', grup:'EKUITAS', tipe:'K' },
  { kode:'3.1.5',  nama:'SHU Tahun Lalu',                   kelompok:'Ekuitas', grup:'EKUITAS', tipe:'K' },
  { kode:'3.1.6',  nama:'SHU Periode Berjalan',             kelompok:'Ekuitas', grup:'EKUITAS', tipe:'K' },
  // ══ PENDAPATAN USAHA ══
  { kode:'4.1.1',  nama:'Pendapatan Jasa Pinjaman',         kelompok:'Pendapatan Usaha',    grup:'PENDAPATAN', tipe:'K' },
  { kode:'4.1.2',  nama:'Pendapatan Administrasi',          kelompok:'Pendapatan Usaha',    grup:'PENDAPATAN', tipe:'K' },
  { kode:'4.1.3',  nama:'Pendapatan Denda',                 kelompok:'Pendapatan Usaha',    grup:'PENDAPATAN', tipe:'K' },
  { kode:'4.1.4',  nama:'Pendapatan Sewa',                  kelompok:'Pendapatan Usaha',    grup:'PENDAPATAN', tipe:'K' },
  { kode:'4.1.5',  nama:'Penjualan Toko',                   kelompok:'Pendapatan Usaha',    grup:'PENDAPATAN', tipe:'K' },
  { kode:'4.1.6',  nama:'Pendapatan konsinyasi',            kelompok:'Pendapatan Usaha',    grup:'PENDAPATAN', tipe:'K' },
  { kode:'4.1.7',  nama:'Retur penjualan',                  kelompok:'Pendapatan Usaha',    grup:'PENDAPATAN', tipe:'D' },
  { kode:'4.1.8',  nama:'Pendapatan Lain-lain',             kelompok:'Pendapatan Usaha',    grup:'PENDAPATAN', tipe:'K' },
  // ══ PENDAPATAN NON-USAHA ══
  { kode:'4.2.1',  nama:'Pendapatan bunga bank',            kelompok:'Pendapatan Non-Usaha', grup:'PENDAPATAN', tipe:'K' },
  { kode:'4.2.2',  nama:'Keuntungan penjualan aset tetap',  kelompok:'Pendapatan Non-Usaha', grup:'PENDAPATAN', tipe:'K' },
  { kode:'4.2.3',  nama:'Keuntungan di luar usaha lainnya', kelompok:'Pendapatan Non-Usaha', grup:'PENDAPATAN', tipe:'K' },
  // ══ BEBAN ══
  { kode:'5.1.1',  nama:'HPP Toko',                                          kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.2',  nama:'Beban Jasa Simpanan Sukarela',                      kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.3',  nama:'Beban penjualan',                                   kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.4',  nama:'Beban penjualan lainnya',                           kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.5',  nama:'Beban Honor/Gaji karyawan',                         kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.6',  nama:'Beban Honor pengurus dan pengawas',                 kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.7',  nama:'Biaya Tunjangan Hari Raya /THR',                    kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.8',  nama:'Beban ATK',                                         kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.9',  nama:'Beban sewa',                                        kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.10', nama:'Beban premi asuransi',                              kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.11', nama:'Beban penyusutan dan amortisasi',                   kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.12', nama:'Beban Listrik, Telepon, Air',                       kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.13', nama:'Biaya Perjalanan Dan transport',                    kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.14', nama:'Biaya pendidikan dan Study Banding Pengurus dan Pengawas', kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.15', nama:'Beban Internet',                                    kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.16', nama:'Biaya Pengurusan Izin Usaha dan Dokumen Perkoperasian',  kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.17', nama:'Beban pendidikan karyawan',                         kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.18', nama:'Beban Penyisihan piutang tak tertagih',             kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.19', nama:'Beban gaji pengurus dan pengawas',                  kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.20', nama:'Beban rapat organisasi',                            kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.21', nama:'Beban pendidikan perkoperasian',                    kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.22', nama:'Beban Rapat anggota',                               kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  { kode:'5.1.23', nama:'Beban perkoperasian lainnya',                       kelompok:'Beban', grup:'BEBAN', tipe:'D' },
  // ══ BEBAN NON-USAHA ══
  { kode:'5.2.1',  nama:'Beban administrasi bank',                           kelompok:'Beban Non-Usaha', grup:'BEBAN', tipe:'D' },
  { kode:'5.2.2',  nama:'Beban pajak bunga',                                 kelompok:'Beban Non-Usaha', grup:'BEBAN', tipe:'D' },
  { kode:'5.2.3',  nama:'Beban di luar usaha lainnya',                       kelompok:'Beban Non-Usaha', grup:'BEBAN', tipe:'D' },
]

// Helper: cari nama akun berdasarkan kode
// ── Hook: merge COA standar + custom dari store (reaktif) ─────────────────
// Semua halaman pakai ini agar otomatis update saat COA diubah di menu Bagan Akun
export function mergeCustomCOA(customCOA: Akun[]): Akun[] {
  const merged = [...COA]
  customCOA.forEach(ca => {
    const idx = merged.findIndex(a => a.kode === ca.kode)
    if (idx >= 0) merged[idx] = ca
    else merged.push(ca)
  })
  // Filter akun yang disembunyikan (nama diawali '__HIDDEN__')
  return merged
    .filter(a => !a.nama.startsWith('__HIDDEN__'))
    .sort((a, b) => a.kode.localeCompare(b.kode, undefined, { numeric: true }))
}

export function getAkunNama(kode: string): string {
  const akun = COA.find(a => a.kode === kode)
  return akun ? akun.nama : kode
}
