import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import axios from "axios";
import db from "./db.js"; // koneksi database
import beritaRoutes from "./routes/beritaRoutes.js"

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Ganti dengan token kamu dari dashboard Fonnte
const FONNTE_TOKEN = "BjMWRoyrKaYJTFBsjcav";

// Tes koneksi database
db.connect((err) => {
  if (err) {    
    console.error("❌ Koneksi database gagal:", err);
  } else {
    console.log("✅ Koneksi database berhasil!");
  }
});

// Endpoint root
app.get("/", (req, res) => {
  res.send("API Berita berjalan 🚀");
});
app.use("/uploads", express.static("uploads"));

app.use("/api/berita", beritaRoutes);

// Endpoint kirim pesan WhatsApp via Fonnte
app.post("/api/kirim-wa", async (req, res) => {
  const { nama, no_wa, pesan } = req.body;

  if (!nama || !no_wa || !pesan) {
    return res.status(400).json({ status: "error", message: "Data tidak lengkap" });
  }

  try {
    const response = await axios.post(
      "https://api.fonnte.com/send",
      {
        target: no_wa, // contoh: 628123456789
        message: `Halo ${nama}! ${pesan}`,
      },
      {
        headers: {
          Authorization: FONNTE_TOKEN,
        },
      }
    );

    res.json({ status: "success", data: response.data });
  } catch (error) {
    console.error("❌ Gagal kirim WA:", error.response?.data || error.message);
    res.status(500).json({ status: "error", message: "Gagal kirim pesan WA" });
  }
});

// Jalankan server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`✅ Server berjalan di http://localhost:${PORT}`);
});
