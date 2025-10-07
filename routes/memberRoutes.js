const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/api/login", (req, res) => {
  const { nama, no_pensiun } = req.body;

  db.query(
    "SELECT * FROM member WHERE nama = ? AND no_pensiun = ?",
    [nama, no_pensiun],
    (err, results) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Gagal login", error: err.message });
      }

      if (results.length === 0) {
        return res.status(401).json({ message: "Nama atau No. Pensiun salah" });
      }

      res.json({ member: results[0] });
    }
  );
});




module.exports = router;
