import mysql from "mysql2";

const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "himpana",
  password: "12345",
  database: "himapana",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Gagal koneksi database:", err);
  } else {
    console.log("✅ Terhubung ke MySQL");
  }
});

export default db;
