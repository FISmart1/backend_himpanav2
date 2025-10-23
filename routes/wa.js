import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { createCanvas, loadImage, registerFont } from 'canvas';
import db from '../db.js';

const router = express.Router();

// Green API
const GREEN_ID = '7105337536';
const GREEN_TOKEN = '38d451148e894a598175e91891fb9ce0f6a4d1157dad426881';

// Folder upload
const uploadDir = 'uploads/wa';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Register font
registerFont('C:/Windows/Fonts/arialbd.ttf', { family: 'ArialBold' });

/* ======================================================
   🧮 Fungsi Generate Card Number otomatis
====================================================== */
function generateCardNumber() {
  const part1 = String(Math.floor(Math.random() * 999)).padStart(3, '0');
  const part2 = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `NA. ${part1}.${part2}`; // Contoh: "NA. 252.00109"
}

/* ======================================================
   🔍 Validasi Format Retirement Number
====================================================== */
function isValidRetirementNumber(value) {
  // Format: 01-9-311589-40
  const pattern = /^\d{2}-\d-\d{6}-\d{2}$/;
  return pattern.test(value);
}

/* ======================================================
   📩 ROUTE: Tambah Member Baru
====================================================== */
router.post('/api/kirim-member', async (req, res) => {
  const { name, retirement_number, phone_number, birth_date, address, city } = req.body;

  if (!name || !retirement_number || !phone_number || !birth_date || !address || !city) {
    return res.status(400).json({ status: 'error', message: 'Data tidak lengkap' });
  }

  if (!isValidRetirementNumber(retirement_number)) {
    return res.status(400).json({
      status: 'error',
      message: 'Format retirement_number tidak valid! Contoh: 01-9-311589-40',
    });
  }

  try {
    const card_number = generateCardNumber();

    // === Generate ID card ===
    const templatePath = path.resolve('assets/ID_CARD_FRONT_2024.jpg');
    const template = await loadImage(templatePath);
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(template, 0, 0);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px ArialBold';
    ctx.fillText(name.toUpperCase(), 47, 520);

    ctx.font = 'bold 28px ArialBold';
    ctx.fillText(`NA. ${retirement_number}`, 47, 560);

    ctx.fillStyle = '#000000';
    ctx.font = '28px ArialBold';
    ctx.fillText(card_number, 715, 330);

    const filename = `idcard-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filePath, canvas.toBuffer('image/jpeg', { quality: 0.95 }));

    const fotoPath = `/uploads/wa/${filename}`;

    // === Simpan ke database dulu (WA boleh gagal nanti) ===
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO members (name, retirement_number, card_number, phone_number, birth_date, address, city, card_image_path)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, retirement_number, card_number, phone_number, birth_date, address, city, fotoPath],
        (err, results) => {
          if (err) {
            // 🔎 Jika error karena duplikat retirement_number
            if (err.code === 'ER_DUP_ENTRY') {
              console.warn('⚠️ Data duplikat untuk retirement_number:', retirement_number);
              return reject({
                type: 'duplicate',
                message: `Nomor pensiun ${retirement_number} sudah terdaftar!`,
              });
            }

            console.error('❌ Gagal simpan ke database:', err);
            return reject({
              type: 'database',
              message: 'Terjadi kesalahan saat menyimpan data ke database.',
              detail: err.message,
            });
          }

          console.log('✅ Data member tersimpan di database:', results.insertId);
          resolve(results);
        }
      );
    });

    console.log('🧩 Menyimpan ke database:', name, retirement_number);

    // === Coba kirim WA (tapi jangan hentikan proses kalau gagal) ===
    try {
      let phoneNumber = phone_number.replace(/[^0-9]/g, '');
      if (phoneNumber.startsWith('0')) phoneNumber = '62' + phoneNumber.slice(1);
      else if (!phoneNumber.startsWith('62')) phoneNumber = '62' + phoneNumber;
      const chatId = `${phoneNumber}@c.us`;

      const form = new FormData();
      form.append('chatId', chatId);
      form.append('caption', `Hai ${name}, ini ID Card kamu 🎫`);
      form.append('file', fs.createReadStream(filePath), {
        filename: 'idcard.jpg',
        contentType: 'image/jpeg',
      });

      const sendUrl = `https://api.green-api.com/waInstance${GREEN_ID}/sendFileByUpload/${GREEN_TOKEN}`;
      const response = await axios.post(sendUrl, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      // Kalau berhasil kirim WA
      return res.json({
        status: 'success',
        message: 'Data tersimpan dan ID Card berhasil dikirim ke WhatsApp',
        foto_idcard: fotoPath,
        data: { name, retirement_number, card_number },
      });
    } catch (waError) {
      console.warn('⚠️ Gagal kirim ke WhatsApp:', waError.message);

      // Tapi tetap sukses simpan data
      return res.json({
        status: 'warning',
        message: 'Data berhasil disimpan tapi gagal kirim WhatsApp.',
        foto_idcard: fotoPath,
        data: { name, retirement_number, card_number },
      });
    }
  } catch (error) {
    console.error('❌ Error utama:', error.message || error);

    if (error.type === 'duplicate') {
      return res.status(400).json({
        status: 'error',
        message: error.message || 'Nomor pensiunan sudah terdaftar di sistem.',
      });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Gagal membuat atau menyimpan data member.',
      detail: error.message,
    });
  }
});

/* ======================================================
   ✏️ ROUTE: Update Member
====================================================== */
router.put('/api/update-member', async (req, res) => {
  const { name, old_retirement_number, retirement_number, phone_number, birth_date, address, city } = req.body;

  if (!name || !old_retirement_number || !retirement_number || !phone_number || !birth_date || !address || !city) {
    return res.status(400).json({ status: 'error', message: 'Data tidak lengkap' });
  }

  if (!isValidRetirementNumber(retirement_number)) {
    return res.status(400).json({
      status: 'error',
      message: 'Format retirement_number tidak valid! Contoh: 01-9-311589-40',
    });
  }

  try {
    // Ambil data lama
    const [rows] = await db.execute('SELECT card_image_path FROM members WHERE retirement_number = ? LIMIT 1', [old_retirement_number]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Data member tidak ditemukan' });
    }

    const oldFotoPath = rows[0].card_image_path;
    if (oldFotoPath && fs.existsSync('.' + oldFotoPath)) {
      await fs.promises.unlink('.' + oldFotoPath);
    }

    // Generate card_number baru
    const card_number = generateCardNumber();

    // Buat ID card baru
    const templatePath = path.resolve('assets/ID_CARD_FRONT_2024.jpg');
    const template = await loadImage(templatePath);
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(template, 0, 0);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px ArialBold';
    ctx.fillText(name.toUpperCase(), 47, 520);

    ctx.font = 'bold 28px ArialBold';
    ctx.fillText(`NA. ${retirement_number}`, 47, 560);

    ctx.fillStyle = '#000000';
    ctx.font = '28px ArialBold';
    ctx.fillText(card_number, 715, 330);

    const filename = `idcard-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filePath, canvas.toBuffer('image/jpeg', { quality: 0.95 }));

    const fotoPath = `/uploads/wa/${filename}`;

    // Update DB
    await db.execute(
      `UPDATE members 
       SET name=?, retirement_number=?, card_number=?, phone_number=?, birth_date=?, address=?, city=?, card_image_path=? 
       WHERE retirement_number=?`,
      [name, retirement_number, card_number, phone_number, birth_date, address, city, fotoPath, old_retirement_number]
    );

    res.json({
      status: 'success',
      message: 'Data berhasil diperbarui dan ID Card baru dibuat',
      foto_idcard: fotoPath,
      data: { retirement_number, card_number },
    });
  } catch (error) {
    console.error('❌ Gagal update member:', error);
    res.status(500).json({
      status: 'error',
      message: 'Gagal update data atau membuat ID Card baru',
      detail: error.message,
    });
  }
});

export default router;
