# 🏦 Bela SAKEP — Sistem Informasi Akuntansi Koperasi

Aplikasi web laporan keuangan koperasi berbasis **SAK EP** (Standar Akuntansi Keuangan Entitas Privat), sesuai **Peraturan Menteri Koperasi No. 2 Tahun 2024**.

> Dikembangkan untuk mendukung platform **Bela SAKEP** — Dinas Koperasi & Usaha Mikro Kabupaten Kediri.

[![Deploy Status](https://github.com/YOUR-USERNAME/sia-koperasi/actions/workflows/deploy.yml/badge.svg)](https://github.com/YOUR-USERNAME/sia-koperasi/actions)

## 🚀 Demo Live

**https://YOUR-USERNAME.github.io/sia-koperasi/**

---

## ✨ Fitur

| Modul | Fitur |
|---|---|
| **Profil Koperasi** | Identitas, pengurus, periode akuntansi |
| **Bagan Akun (COA)** | 74 akun SAK EP standar (1.1.x – 5.2.x) |
| **Data Anggota** | Master data anggota koperasi |
| **Saldo Awal** | Input saldo pembuka dengan validasi D=K |
| **Jurnal Umum** | Double-entry, validasi balance real-time |
| **Buku Besar** | Filter per akun & tanggal, saldo berjalan |
| **Simpanan** | Rekap simpanan pokok, wajib, sukarela |
| **Piutang SP** | Buku pembantu piutang simpan pinjam |
| **Toko** | Rekap penjualan & piutang toko |
| **Neraca** | Laporan Posisi Keuangan SAK EP |
| **PHU/SHU** | Laporan Hasil Usaha + Perhitungan SHU |
| **Ekuitas** | Laporan Perubahan Ekuitas |
| **Arus Kas** | Metode Langsung (3 aktivitas) |
| **Alokasi SHU** | Pembagian SHU per anggota |
| **Ekspor Excel** | Download .xlsx semua laporan |
| **Cetak** | Print-friendly CSS |

---

## 🛠️ Tech Stack

- **React 18** + **TypeScript** (Vite)
- **Tailwind CSS v3**
- **Zustand** (state management + localStorage persistence)
- **SheetJS (xlsx)** (ekspor Excel)
- **Lucide React** (ikon)
- **GitHub Pages** (hosting gratis)

---

## 📦 Setup Lokal

```bash
# 1. Clone repo
git clone https://github.com/YOUR-USERNAME/sia-koperasi.git
cd sia-koperasi

# 2. Install dependensi
npm install

# 3. Jalankan development server
npm run dev
# → http://localhost:5173/sia-koperasi/

# 4. Build production
npm run build

# 5. Preview build
npm run preview
```

---

## 🚀 Deploy ke GitHub Pages

### Langkah 1 — Fork / Push ke GitHub

```bash
git init
git add .
git commit -m "feat: initial Bela SAKEP SIA"
git remote add origin https://github.com/YOUR-USERNAME/sia-koperasi.git
git push -u origin main
```

### Langkah 2 — Aktifkan GitHub Pages

1. Buka repo di GitHub → **Settings** → **Pages**
2. Di bagian **Source**, pilih **GitHub Actions**
3. Simpan

### Langkah 3 — Sesuaikan `vite.config.ts`

```ts
// vite.config.ts
export default defineConfig({
  base: '/sia-koperasi/',  // ← ganti dengan nama repo kamu
  plugins: [react()],
})
```

### Langkah 4 — Push & Deploy Otomatis

Setiap `git push` ke branch `main` akan memicu deploy otomatis via **GitHub Actions**.

URL live: `https://YOUR-USERNAME.github.io/sia-koperasi/`

---

## 📂 Struktur Proyek

```
sia-koperasi/
├── .github/
│   └── workflows/
│       ├── deploy.yml      ← Deploy ke GitHub Pages
│       └── ci.yml          ← Type check + build check (PR)
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx     ← Navigasi sidebar
│   │   └── ui.tsx          ← Komponen UI reusable
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── IdentitasPage.tsx
│   │   ├── COAPage.tsx
│   │   ├── AnggotaPage.tsx
│   │   ├── SaldoAwalPage.tsx
│   │   ├── JurnalPage.tsx
│   │   ├── BukuBesarPage.tsx
│   │   ├── LaporanPages.tsx    ← Neraca, SHU, Ekuitas, Arus Kas
│   │   └── BukuPembantuPages.tsx ← SHU, Simpanan, Piutang, Toko
│   ├── store/
│   │   └── useAppStore.ts  ← Zustand store + localStorage
│   ├── types/
│   │   └── index.ts        ← TypeScript types
│   └── utils/
│       ├── coa.ts           ← 74 akun COA SAK EP
│       ├── accounting.ts    ← Engine kalkulasi akuntansi
│       └── exportExcel.ts   ← SheetJS export
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

---

## ⚠️ Catatan Penting

- **Data tersimpan di LocalStorage browser** — tidak ada server/database.
- Untuk backup, gunakan fitur **Ekspor Excel** secara berkala.
- Jika berganti browser/device, data tidak akan terbawa. Pertimbangkan export/import JSON untuk migrasi data.

---

## 📄 Lisensi

MIT — bebas digunakan dan dimodifikasi untuk keperluan koperasi.
