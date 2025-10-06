import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import fs from "fs";
import path from "path";
import db from "./db.js";
import beritaRoutes from "./routes/beritaRoutes.js";
import artikelRoutes from "./routes/artikelRoute.js";
import router from "./routes/wa.js";
import { createCanvas } from "canvas";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// === KONFIGURASI ===
const FONNTE_TOKEN = "BjMWRoyrKaYJTFBsjcav"; // token kamu
const uploadDir = path.join(process.cwd(), "uploads/wa");

// Pastikan folder upload ada
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// === KONEKSI DATABASE ===
db.connect((err) => {
  if (err) {
    console.error("❌ Koneksi database gagal:", err);
  } else {
    console.log("✅ Koneksi database berhasil!");
  }
});

// === ROUTES UTAMA ===
app.get("/", (req, res) => {
  res.send("API Himpana berjalan 🚀");
});

// static file upload
app.use("/uploads", express.static("uploads"));

// routes berita & artikel
app.use("/api/berita", beritaRoutes);
app.use("/api/artikel", artikelRoutes);
app.use(router)

// === ENDPOINT KIRIM WHATSAPP ===


// === JALANKAN SERVER ===
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
