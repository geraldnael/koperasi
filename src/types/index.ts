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
}

export interface JurnalEntry {
  id: number
  tanggal: string
  nobukti: string
  keterangan: string
  rows: JurnalBaris[]
  total: number
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
