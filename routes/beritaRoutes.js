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
    cb(null, "uploads/berita");
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error("Hanya file gambar (JPG, JPEG, PNG, WEBP) yang diperbolehkan"));
  },
});

// Pastikan folder ada
if (!fs.existsSync("uploads/berita")) {
  fs.mkdirSync("uploads/berita", { recursive: true });
}

// === CRUD BERITA ===

// GET semua berita
router.get("/", (req, res) => {
  db.query("SELECT * FROM berita ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET berita by ID
router.get("/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM berita WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(404).json({ message: "Berita tidak ditemukan" });
    res.json(results[0]);
  });
});

// POST tambah berita
router.post("/", upload.single("foto"), async (req, res) => {
  const { judul, isi, penulis, tanggal } = req.body;
  if (!judul || !isi) return res.status(400).json({ message: "Judul dan isi wajib diisi" });

  let fotoPath = null;

  if (req.file) {
    const originalPath = req.file.path;
    const compressedPath = `uploads/berita/compressed-${req.file.filename}`;

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
    "INSERT INTO berita (judul, isi, penulis, tanggal, foto) VALUES (?, ?, ?, ?, ?)",
    [judul, isi, penulis, tanggal, fotoPath],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berita berhasil ditambahkan", id: result.insertId });
    }
  );
});

// PUT update berita
router.put("/:id", upload.single("foto"), async (req, res) => {
  const { id } = req.params;
  const { judul, isi, penulis, tanggal } = req.body;
  let fotoPath = null;

  if (req.file) {
    const originalPath = req.file.path;
    const compressedPath = `uploads/berita/compressed-${req.file.filename}`;

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

  let sql = "UPDATE berita SET judul = ?, isi = ?, penulis = ?, tanggal = ?";
  const values = [judul, isi, penulis, tanggal];

  if (fotoPath) {
    sql += ", foto = ?";
    values.push(fotoPath);
  }

  sql += " WHERE id = ?";
  values.push(id);

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berita berhasil diperbarui" });
  });
});

// DELETE berita
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM berita WHERE id = ?", [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berita berhasil dihapus" });
  });
});

export default router;
