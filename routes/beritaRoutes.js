const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");

// === Konfigurasi multer ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/berita"); // folder penyimpanan
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // batas 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file gambar (JPG, JPEG, PNG, WEBP) yang diperbolehkan"));
    }
  },
});

// Pastikan folder uploads/berita ada
const fs = require("fs");
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

// GET berita berdasarkan ID
router.get("/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM berita WHERE id = ?", [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(404).json({ message: "Berita tidak ditemukan" });
    res.json(results[0]);
  });
});

// POST tambah berita baru + upload foto
router.post("/", upload.single("foto"), (req, res) => {
  const { judul, isi, penulis } = req.body;
  const foto = req.file ? `/uploads/berita/${req.file.filename}` : null;

  if (!judul || !isi)
    return res.status(400).json({ message: "Judul dan isi wajib diisi" });

  db.query(
    "INSERT INTO berita (judul, isi, penulis, foto) VALUES (?, ?, ?, ?)",
    [judul, isi, penulis, foto],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Berita berhasil ditambahkan", id: result.insertId });
    }
  );
});

// PUT update berita (tanpa atau dengan foto baru)
router.put("/:id", upload.single("foto"), (req, res) => {
  const { id } = req.params;
  const { judul, isi, penulis } = req.body;
  const foto = req.file ? `/uploads/berita/${req.file.filename}` : null;

  let sql = "UPDATE berita SET judul = ?, isi = ?, penulis = ?";
  const values = [judul, isi, penulis];

  if (foto) {
    sql += ", foto = ?";
    values.push(foto);
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

  db.query("DELETE FROM berita WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Berita berhasil dihapus" });
  });
});

module.exports = router;
