import express from "express";
import db from "../db.js";

const router = express.Router();

// GET /api/v1/province
router.get("/", async (req, res) => {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.query("SELECT * FROM provinces ORDER BY name ASC", (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    res.json({
      success: true,
      message: "Provinces retrieved successfully",
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database error while fetching provinces",
      error: error.message
    });
  }
});

// GET /api/v1/province/:provinceId
router.get("/:provinceId", async (req, res) => {
  const { provinceId } = req.params;

  try {
    const rows = await new Promise((resolve, reject) => {
      db.query(
        "SELECT * FROM branches WHERE province_id = ? ORDER BY name ASC",
        [provinceId],
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No branches found for this province"
      });
    }

    res.json({
      success: true,
      message: "Branches retrieved successfully",
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database error while fetching branches",
      error: error.message
    });
  }
});

export default router;
