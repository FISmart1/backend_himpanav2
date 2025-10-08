// db.js
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root", // sesuaikan
  password: "",
  database: "himpanac_backend", // sesuaikan nama DB
});

db.connect((err) => {
  if (err) {
    console.error("❌ Gagal koneksi database:", err);
  } else {
    console.log("✅ Terhubung ke MySQL");
  }
});

module.exports = db;
