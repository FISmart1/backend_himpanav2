import express from "express";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { createCanvas } from "canvas";

const router = express.Router();
const FONNTE_TOKEN = "BjMWRoyrKaYJTFBsjcav";

const uploadDir = "uploads/wa";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

router.post("/api/kirim-wa", async (req, res) => {
  const { nama, no_wa, pesan } = req.body;
  if (!nama || !no_wa || !pesan) {
    return res.status(400).json({ status: "error", message: "Data tidak lengkap" });
  }

  try {
    // === 1️⃣ Buat gambar ===
    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#cce7ff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#003366";
    ctx.font = "bold 36px Sans";
    ctx.fillText(`Halo, ${nama}!`, 50, 100);

    ctx.font = "28px Sans";
    ctx.fillText(pesan, 50, 180);

    ctx.font = "18px Sans";
    ctx.fillStyle = "#666";
    ctx.fillText("HIMPANA", 650, 370);

    const filename = `wa-${Date.now()}.png`;
    const filePath = path.join(uploadDir, filename);
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(filePath, buffer);

    // === 2️⃣ Kirim ke Fonnte pakai FormData (Node.js) ===
    const form = new FormData();
    form.append("target", no_wa);
    form.append("message", `Hai ${nama}, ini pesanmu:\n${pesan}`);
    form.append("file", fs.createReadStream(filePath)); // 👈 pakai stream, bukan Blob

    const response = await axios.post("https://api.fonnte.com/send", form, {
      headers: {
        ...form.getHeaders(),
        Authorization: FONNTE_TOKEN,
      },
    });

    res.json({
      status: "success",
      message: "Pesan dan gambar berhasil dikirim",
      data: response.data,
    });
  } catch (error) {
    console.error("❌ Gagal kirim WA:", error.response?.data || error.message);
    res.status(500).json({ status: "error", message: "Gagal kirim pesan WA" });
  }
});

export default router;
