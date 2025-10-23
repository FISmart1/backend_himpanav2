import express from "express";
import db from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const router = express.Router();

// === Konfigurasi multer ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/artikel");
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error("Hanya file gambar (JPG, JPEG, PNG, WEBP) yang diperbolehkan"));
  },
});

// Pastikan folder ada
if (!fs.existsSync("uploads/artikel")) {
  fs.mkdirSync("uploads/artikel", { recursive: true });
}

// === CRUD ARTIKEL ===

// GET semua artikel
router.get("/", (req, res) => {
  db.query("SELECT * FROM artikel ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET artikel by ID
router.get("/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM artikel WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(404).json({ message: "Artikel tidak ditemukan" });
    res.json(results[0]);
  });
});

// POST tambah artikel + upload foto
router.post("/", upload.single("foto"), async (req, res) => {
  const { judul, isi, penulis, tanggal, kategori } = req.body;
  if (!judul || !isi) return res.status(400).json({ message: "Judul dan isi wajib diisi" });

  let fotoPath = null;

  if (req.file) {
    const originalPath = req.file.path;
    const compressedPath = `uploads/artikel/himpana-${req.file.filename}`;

    try {
      await sharp(originalPath)
        .resize({ width: 1000 })
        .jpeg({ quality: 70 })
        .toFile(compressedPath);

      fs.unlinkSync(originalPath);
      fotoPath = `/${compressedPath}`;
    } catch (err) {
      console.error("Gagal kompres gambar:", err);
      fotoPath = `/${originalPath}`;
    }
  }

  db.query(
    "INSERT INTO artikel (judul, isi, penulis, foto, tanggal, kategori) VALUES (?, ?, ?, ?, ?, ?)",
    [judul, isi, penulis, fotoPath, tanggal, kategori],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Artikel berhasil ditambahkan", id: result.insertId });
    }
  );
});

// PUT update artikel
router.put("/:id", upload.single("foto"), async (req, res) => {
  const { id } = req.params;
  const { judul, isi, penulis, tanggal, kategori } = req.body;
  let fotoPath = null;

  if (req.file) {
    const originalPath = req.file.path;
    const compressedPath = `uploads/artikel/himpana-${req.file.filename}`;

    try {
      await sharp(originalPath)
        .resize({ width: 1000 })
        .jpeg({ quality: 70 })
        .toFile(compressedPath);

      fs.unlinkSync(originalPath);
      fotoPath = `/${compressedPath}`;
    } catch (err) {
      console.error("Gagal kompres gambar:", err);
      fotoPath = `/${originalPath}`;
    }
  }

  let sql = "UPDATE artikel SET judul = ?, isi = ?, penulis = ?, tanggal = ?, kategori = ?";
  const values = [judul, isi, penulis, tanggal, kategori];

  if (fotoPath) {
    sql += ", foto = ?";
    values.push(fotoPath);
  }

  sql += " WHERE id = ?";
  values.push(id);

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Artikel berhasil diperbarui" });
  });
});

// DELETE artikel
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM artikel WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Artikel berhasil dihapus" });
  });
});

export default router;
