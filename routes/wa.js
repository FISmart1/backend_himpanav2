import express from "express";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { createCanvas, loadImage, registerFont } from "canvas";
import db from "../db.js";
import mysql from "mysql2/promise";

const router = express.Router();

// Green API
const GREEN_ID = "7105337536";
const GREEN_TOKEN = "38d451148e894a598175e91891fb9ce0f6a4d1157dad426881";

// Folder upload
const uploadDir = "uploads/wa";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

registerFont("C:/Windows/Fonts/arialbd.ttf", { family: "ArialBold" });

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "passwordmu",
  database: "namadb",
};

router.post("/api/kirim-wa", async (req, res) => {
  const { nama, no_pensiunan, no_wa, hari_lahir, alamat, kota } = req.body;

  if (!nama || !no_pensiunan || !no_wa || !hari_lahir || !alamat || !kota) {
    return res.status(400).json({
      status: "error",
      message: "Data tidak lengkap",
    });
  }

  try {
    // === Canvas & ID Card ===
    const template = await loadImage(path.resolve("assets/ID_CARD_FRONT_2024.jpg"));
    const canvas = createCanvas(template.width, template.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(template, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px ArialBold";
    ctx.fillText(nama.toUpperCase(), 47, 520);

    ctx.font = "bold 28px ArialBold";
    ctx.fillText(`NA. ${no_pensiunan}`, 47, 560);

    ctx.fillStyle = "#000000";
    ctx.font = "28px ArialBold";
    ctx.fillText(`NP. ${no_pensiunan}`, 715, 330);

    const filename = `idcard-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filePath, canvas.toBuffer("image/jpeg", { quality: 0.95 }));

    // === Simpan data + path gambar ke DB ===
    const fotoPath = `/uploads/wa/${filename}`; // path relatif untuk akses dari web
    await db.execute(
      "INSERT INTO member (nama, no_pensiun, no_wa, hari_lahir, alamat, kota, foto_idcard) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nama, no_pensiunan, no_wa, hari_lahir, alamat, kota, fotoPath]
    );

    // === Kirim ke WhatsApp ===
    let phoneNumber = no_wa.replace(/[^0-9]/g, "");
    if (phoneNumber.startsWith("0")) phoneNumber = "62" + phoneNumber.slice(1);
    else if (!phoneNumber.startsWith("62")) phoneNumber = "62" + phoneNumber;
    const chatId = `${phoneNumber}@c.us`;

    const form = new FormData();
    form.append("chatId", chatId);
    form.append("caption", `Hai ${nama}, ini ID Card kamu 🎫`);
    form.append("file", fs.createReadStream(filePath), {
      filename: "idcard.jpg",
      contentType: "image/jpeg",
    });

    const sendUrl = `https://api.green-api.com/waInstance${GREEN_ID}/sendFileByUpload/${GREEN_TOKEN}`;
    const response = await axios.post(sendUrl, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    res.json({
      status: "success",
      message: "Pesan & gambar berhasil dikirim",
      data: response.data,
      foto_idcard: fotoPath,
    });

    // (JANGAN dihapus file-nya agar bisa diakses profil)
  } catch (error) {
    console.error("❌ Gagal kirim WA:", error.response?.data || error.message);
    res.status(500).json({
      status: "error",
      message: "Gagal kirim WA",
      detail: error.response?.data || error.message,
    });
  }
});

export default router;
