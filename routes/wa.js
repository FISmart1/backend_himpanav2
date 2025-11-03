import express from 'express';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import db from '../db.js';
import qrcode from 'qrcode-terminal';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;

const router = express.Router();

// Folder upload
const uploadDir = 'uploads/wa';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Register font
registerFont('../fonts/arialbd.ttf', { family: 'ArialBold' });

/* ======================================================
   ⚙️ Setup WhatsApp Web Client
====================================================== */
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './wa-session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('📱 Scan QR untuk login WhatsApp:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp Web siap digunakan!');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Gagal autentikasi WhatsApp:', msg);
});

client.initialize();

/* ======================================================
   🧮 Fungsi Generate Card Number otomatis
====================================================== */
function generateCardNumber() {
  const part1 = String(Math.floor(Math.random() * 999)).padStart(3, '0');
  const part2 = String(Math.floor(Math.random() * 99999)).padStart(5, '0');
  return `NA. ${part1}.${part2}`;
}

/* ======================================================
   🔍 Validasi Format Retirement Number
====================================================== */
function isValidRetirementNumber(value) {
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
    ctx.fillText(card_number, 47, 560);

    ctx.fillStyle = '#000000';
    ctx.font = '28px ArialBold';
    ctx.fillText(`NP. ${retirement_number}`, 715, 330);

    const filename = `idcard-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filePath, canvas.toBuffer('image/jpeg', { quality: 0.95 }));

    const fotoPath = `/uploads/wa/${filename}`;

    // === Simpan ke database ===
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO members (name, retirement_number, card_number, phone_number, birth_date, address, city, card_image_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, retirement_number, card_number, phone_number, birth_date, address, city, fotoPath],
        (err, results) => {
          if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
              return reject({
                type: 'duplicate',
                message: `Nomor pensiun ${retirement_number} sudah terdaftar!`,
              });
            }
            return reject({
              type: 'database',
              message: 'Kesalahan saat menyimpan data ke database.',
              detail: err.message,
            });
          }
          resolve(results);
        }
      );
    });

    console.log('🧩 Member tersimpan di database:', name, retirement_number);

    // === Kirim ke WhatsApp (whatsapp-web.js) ===
    try {
      if (!client.info || !client.info.wid) {
        throw new Error('Client WhatsApp belum siap. Tunggu sampai QR discan.');
      }

      let phoneNumber = phone_number.replace(/[^0-9]/g, '');
      if (phoneNumber.startsWith('0')) phoneNumber = '62' + phoneNumber.slice(1);
      else if (!phoneNumber.startsWith('62')) phoneNumber = '62' + phoneNumber;
      const chatId = phoneNumber + '@c.us';

      const caption = `Hai ${name}, selamat anda telah menjadi anggota baru HIMPANA`;
      const media = MessageMedia.fromFilePath(filePath);

      // kirim teks dan media
      await client.sendMessage(chatId, caption);
      await client.sendMessage(chatId, media, { caption: 'ini 🎫ID Card Kamu' });

      return res.json({
        status: 'success',
        message: 'Data tersimpan dan ID Card berhasil dikirim ke WhatsApp.',
        foto_idcard: fotoPath,
        data: { name, retirement_number, card_number },
      });
    } catch (waError) {
      console.warn('⚠️ Gagal kirim ke WhatsApp:', waError.message);
      return res.json({
        status: 'warning',
        message: 'Data berhasil disimpan tapi gagal kirim ke WhatsApp.',
        foto_idcard: fotoPath,
        data: { name, retirement_number, card_number },
      });
    }
  } catch (error) {
    console.error('❌ Error utama:', error.message || error);

    if (error.type === 'duplicate') {
      return res.status(400).json({
        status: 'error',
        message: error.message,
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
    const [oldData] = await db.promise().query(
      'SELECT card_image_path FROM members WHERE retirement_number = ? LIMIT 1',
      [old_retirement_number]
    );

    if (!oldData.length) {
      return res.status(404).json({ status: 'error', message: 'Data member lama tidak ditemukan.' });
    }

    if (retirement_number !== old_retirement_number) {
      const [dupeCheck] = await db.promise().query(
        'SELECT retirement_number FROM members WHERE retirement_number = ? LIMIT 1',
        [retirement_number]
      );
      if (dupeCheck.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: `Nomor pensiun ${retirement_number} sudah terdaftar!`,
        });
      }
    }

    const oldFotoPath = oldData[0].card_image_path;
    if (oldFotoPath && fs.existsSync('.' + oldFotoPath)) {
      await fs.promises.unlink('.' + oldFotoPath);
    }

    const card_number = generateCardNumber();

    // Buat ID Card baru
    const templatePath = path.resolve('assets/ID_CARD_FRONT_2024.jpg');
    const template = await loadImage(templatePath);
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(template, 0, 0);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px ArialBold';
    ctx.fillText(name.toUpperCase(), 47, 520);

    ctx.font = 'bold 28px ArialBold';
    ctx.fillText(`NP. ${retirement_number}`, 47, 560);

    ctx.fillStyle = '#000000';
    ctx.font = '28px ArialBold';
    ctx.fillText(card_number, 715, 330);

    const filename = `idcard-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filePath, canvas.toBuffer('image/jpeg', { quality: 0.95 }));

    const fotoPath = `/uploads/wa/${filename}`;

    await db.promise().query(
      `UPDATE members 
       SET name=?, retirement_number=?, phone_number=?, birth_date=?, address=?, city=?, card_image_path=? 
       WHERE retirement_number=?`,
      [name, retirement_number, phone_number, birth_date, address, city, fotoPath, old_retirement_number]
    );

    res.json({
      status: 'success',
      message: 'Data berhasil diperbarui dan ID Card baru dibuat',
      foto_idcard: fotoPath,
      data: { name, retirement_number, card_number },
    });
  } catch (error) {
    console.error('❌ Gagal update member:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        status: 'error',
        message: `Nomor pensiun ${retirement_number} sudah terdaftar di sistem.`,
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Gagal update data atau membuat ID Card baru',
      detail: error.message,
    });
  }
});

export default router;
