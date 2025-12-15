# 🚀 Panduan Deploy ke Vercel

## Persiapan

1. Pastikan semua perubahan sudah di-commit dan di-push ke GitHub
2. Pastikan repository sudah terhubung dengan GitHub

## Langkah-langkah Deploy

### 1. Login ke Vercel

- Kunjungi https://vercel.com
- Login dengan akun GitHub Anda
- Klik "Add New Project"

### 2. Import Project

- Pilih repository `lixie` dari daftar repository GitHub Anda
- Klik "Import"

### 3. Konfigurasi Project

**Project Name:** `lixie` (atau sesuai keinginan)

**Framework Preset:** Next.js (otomatis terdeteksi)

**Root Directory:** `./` (default)

**Build Command:** `pnpm build` (atau `npm run build` jika menggunakan npm)

**Output Directory:** `.next` (default untuk Next.js)

**Install Command:** `pnpm install` (atau `npm install`)

### 4. Environment Variables

**PENTING:** Tambahkan semua environment variables berikut di Vercel:

1. Klik "Environment Variables" di halaman project settings
2. Tambahkan variabel berikut:

```
NEXT_PUBLIC_GROQ_API_KEY=your_actual_groq_api_key_here
```

ATAU (lebih aman untuk server-only):

```
GROQ_API_KEY=your_actual_groq_api_key_here
```

```
DATABASE_URL=your_neon_database_connection_string_here
```

ATAU:

```
NEXT_PUBLIC_NEON_CONNECTION_STRING=your_neon_database_connection_string_here
```

**Catatan:**
- Jangan gunakan `NEXT_PUBLIC_` prefix untuk variabel yang tidak perlu diakses di client-side
- Untuk `GROQ_API_KEY` (tanpa NEXT_PUBLIC_), hanya bisa diakses di server-side (lebih aman)
- Untuk `DATABASE_URL` (tanpa NEXT_PUBLIC_), hanya bisa diakses di server-side (lebih aman)

### 5. Deploy

- Klik "Deploy"
- Tunggu proses build selesai
- Setelah selesai, aplikasi akan tersedia di URL: `https://lixie.vercel.app` (atau sesuai nama project)

## Setelah Deploy

### Verifikasi

1. Buka URL aplikasi di browser
2. Cek apakah aplikasi berjalan dengan baik
3. Test fitur-fitur utama:
   - Loading artikel
   - Navigasi antar kategori
   - Dark mode
   - PWA features

### Monitoring

- Gunakan Vercel Dashboard untuk monitoring:
  - Logs
  - Analytics
  - Performance metrics

### Update Environment Variables

Jika perlu mengubah environment variables:
1. Buka Project Settings > Environment Variables
2. Edit atau tambah variabel baru
3. Redeploy aplikasi (otomatis atau manual)

## Troubleshooting

### Build Error

- Cek logs di Vercel Dashboard
- Pastikan semua dependencies terinstall dengan benar
- Pastikan Node.js version sesuai (Next.js 16 memerlukan Node.js 18+)

### Environment Variables Tidak Terdeteksi

- Pastikan variabel sudah ditambahkan di Vercel
- Pastikan nama variabel sesuai (case-sensitive)
- Redeploy setelah menambahkan variabel baru

### Database Connection Error

- Pastikan `DATABASE_URL` sudah benar
- Pastikan database Neon sudah aktif
- Cek apakah connection string menggunakan SSL mode

### API Key Error

- Pastikan `GROQ_API_KEY` atau `NEXT_PUBLIC_GROQ_API_KEY` sudah ditambahkan
- Pastikan API key masih valid
- Cek quota di Groq Console

## Tips

1. **Gunakan Preview Deployments:** Setiap push ke branch akan membuat preview deployment
2. **Production Branch:** Set default branch (biasanya `main` atau `master`) untuk production
3. **Custom Domain:** Bisa menambahkan custom domain di Project Settings > Domains
4. **Analytics:** Aktifkan Vercel Analytics untuk monitoring performa

## Keamanan

✅ **Sudah dilakukan:**
- Semua credentials menggunakan environment variables
- `.env.local` sudah di `.gitignore`
- Tidak ada hardcoded credentials di code
- API URL menggunakan relative path di production

✅ **Best Practices:**
- Gunakan `GROQ_API_KEY` (tanpa NEXT_PUBLIC_) untuk server-only access
- Gunakan `DATABASE_URL` (tanpa NEXT_PUBLIC_) untuk server-only access
- Jangan commit file `.env.local` ke GitHub
- Gunakan Vercel Environment Variables untuk production

