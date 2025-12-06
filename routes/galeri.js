const express = require("express");
const router = express.Router();
const db = require("../config/db");
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");

// Konfigurasi upload folder
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/galeri/");
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + ".jpg");
  },
});

const upload = multer({ storage });

// ========================
//        GET GALERI
// ========================
router.get("/", (req, res) => {
  db.query("SELECT * FROM galeri ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// GET BY berita_id
router.get("/berita/:berita_id", (req, res) => {
  const { berita_id } = req.params;

  db.query(
    "SELECT * FROM galeri WHERE berita_id = ? ORDER BY id DESC",
    [berita_id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// ========================
//        POST GALERI
// ========================
router.post("/", upload.single("img"), async (req, res) => {
  const { berita_id } = req.body;
  if (!berita_id)
    return res.status(400).json({ message: "berita_id wajib diisi" });

  let imgPath = null;

  if (req.file) {
    const originalPath = req.file.path;
    const compressedPath = `uploads/galeri/galeri-${req.file.filename}`;

    try {
      await sharp(originalPath)
        .resize({ width: 1200 }) // ukuran default galeri
        .jpeg({ quality: 70 })
        .toFile(compressedPath);

      fs.unlinkSync(originalPath);
      imgPath = `/${compressedPath}`;
    } catch (err) {
      console.error("Gagal compress gambar:", err);
      imgPath = `/${originalPath}`;
    }
  } else {
    return res.status(400).json({ message: "Gambar wajib diupload" });
  }

  db.query(
    "INSERT INTO galeri (berita_id, img) VALUES (?, ?)",
    [berita_id, imgPath],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      res.json({
        message: "Galeri berhasil ditambahkan",
        id: result.insertId,
      });
    }
  );
});

module.exports = router;
