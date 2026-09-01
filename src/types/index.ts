export type TipeAkun = 'ASET' | 'KEWAJIBAN' | 'EKUITAS' | 'PENDAPATAN' | 'BEBAN'
export type SaldoNormal = 'D' | 'K'

export interface Akun {
  kode: string
  nama: string
  kelompok: string
  grup: TipeAkun
  tipe: SaldoNormal
}

export interface Identitas {
  nama: string
  bh: string
  alamat: string
  kelurahan: string
  kecamatan: string
  kota: string
  ketua: string
  bendahara: string
  sekretaris: string
  tahun: string
  awal: string
  akhir: string
}

export interface JurnalBaris {
  id: string
  ket: string
  kode_d: string
  debet: number
  kode_k: string
  kredit: number
  // Nama pihak penerima/pemberi untuk keperluan kwitansi Kas/Bank — TERPISAH
  // dari `ket` (Nama Anggota, dipakai untuk buku pembantu simpanan/piutang).
  // `ket` harus persis nama anggota terdaftar; `pihak` bebas teks apa saja
  // (vendor, toko, pihak luar, dll) karena tidak divalidasi ke daftar anggota.
  pihak?: string
}

export interface JurnalEntry {
  id: number
  tanggal: string
  nobukti: string
  keterangan: string
  rows: JurnalBaris[]
  total: number
  // Penanda internal: apakah dampak jurnal ini ke SALDO AWAL JASA SIMPANAN
  // SUKARELA (akun 2.1.12) SUDAH diterapkan ke data anggota. Jurnal lama
  // (dibuat sebelum fitur ini ada) defaultnya false/undefined sampai
  // disinkronkan lewat menu "Sinkronkan Saldo Jasa dari Jurnal Lama".
  jasaSukSynced?: boolean
}

export interface AppState {
  identitas: Identitas
  saldoAwal: Record<string, number>
  jurnal: JurnalEntry[]
  nextId: number
}

/** Arsip data 1 tahun buku yang sudah ditutup — dasar Neraca Komparatif */
export interface ArsipTahun {
  tahun: string
  identitas: Identitas
  saldoAwal: Record<string, number>
  saldoAkhir: Record<string, number>
  jumlahJurnal: number
  ditutupPada: string   // ISO timestamp saat tutup buku dilakukan
}
