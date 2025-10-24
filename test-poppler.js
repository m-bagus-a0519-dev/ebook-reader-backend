const path = require('path');
const fs = require('fs');

// Fungsi tes asinkron
async function runTest() {
  console.log("===============================");
  console.log("   MEMULAI TES NODE-POPPLER    ");
  console.log("===============================");

  try {
    // --- 1. Coba Impor Library ---
    console.log("[1/5] Mengimpor 'node-poppler'...");
    const { Poppler } = await import('node-poppler');
    console.log("      > Sukses. Class 'Poppler' ditemukan.");

    // --- 2. Coba Buat Instansiasi Class ---
    console.log("[2/5] Membuat instansiasi Poppler...");
    const poppler = new Poppler();
    console.log("      > Sukses. Objek poppler dibuat.");

    // --- 3. Verifikasi Fungsi ---
    console.log("[3/5] Memeriksa fungsi 'pdfToImg'...");
    if (typeof poppler.pdfToImg !== 'function') {
      console.error("      > !!! GAGAL: poppler.pdfToImg BUKAN FUNGSI!");
      console.error("      > Ini adalah akar masalahnya. Library tidak ter-load dengan benar.");
      return;
    }
    console.log("      > Sukses. Fungsi 'pdfToImg' ditemukan.");

    // --- 4. Siapkan File untuk Konversi ---
    console.log("[4/5] Menyiapkan path file...");
    
    // !!! PENTING: UBAH NAMA FILE INI !!!
    // Salin salah satu PDF Anda ke 'uploads/books/' dan tulis namanya di bawah
    const NAMA_FILE_PDF_ANDA = "97c55a75-4562-4049-8aee-6964c01d520a_original.pdf";
    
    // !!! ----------------------------- !!!

    const pdfPath = path.join(__dirname, 'uploads', 'books', NAMA_FILE_PDF_ANDA);
    const outDir = path.join(__dirname, 'uploads', 'test_covers'); // Folder output tes

    if (!fs.existsSync(pdfPath)) {
      console.error(`      > !!! GAGAL: File PDF tes tidak ditemukan di: ${pdfPath}`);
      console.error("      > Harap salin file PDF ke sana dan perbarui NAMA_FILE_PDF_ANDA di skrip ini.");
      return;
    }
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    console.log(`      > Siap mengkonversi: ${pdfPath}`);

    // --- 5. Jalankan Konversi ---
    const options = {
      jpeg: true,
      out_dir: outDir,
      out_prefix: 'test-cover',
      firstPageToConvert: 1,
      lastPageToConvert: 1
    };
    
    console.log("[5/5] Menjalankan poppler.pdfToImg()...");
    await poppler.pdfToImg(pdfPath, options);

    console.log("\n===============================");
    console.log("   ✅✅✅ TES BERHASIL ✅✅✅   ");
    console.log(`   Silakan cek folder: ${outDir}`);
    console.log("===============================");

  } catch (err) {
    console.error("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error("!!!     TES GAGAL TOTAL     !!!");
    console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
    console.error(err);
  }
}

runTest();