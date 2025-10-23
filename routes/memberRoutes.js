import express from "express";
import db from "../db.js";

const router = express.Router();

router.post("/api/login", (req, res) => {
  const { name, retirement_number } = req.body;

  db.query(
    "SELECT * FROM members WHERE name = ? AND retirement_number = ?",
    [name, retirement_number],
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

export default router;
