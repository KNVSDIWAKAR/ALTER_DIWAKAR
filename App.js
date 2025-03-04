const express = require("express");
const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const redis = require("redis");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const session = require("express-session");

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

const redisClient = redis.createClient({
  socket: {
    host: "127.0.0.1",
    port: 6379,
  },
});

redisClient
  .connect()
  .then(() => console.log("Redis Connected Successfully"))
  .catch((err) => console.error("Redis Connection Error:", err));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection()
  .then(() => console.log("MySQL connected"))
  .catch((err) => console.error("MySQL connection error:", err));

const { verifyApiKey } = require("./middleware/authMiddleware")(db);
const analyticsRoutes = require("./routes/analytics")(db, redisClient);
const authRoutes = require("./routes/auth")(db);

const passport = require("./config/googleAuth");

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes);
app.use("/api/analytics", verifyApiKey, analyticsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

db.query("SELECT 1 + 2 AS three")
  .then(([rows]) => console.log("Test Query Result:", rows))
  .catch((err) => console.error("MySQL Test Query Error:", err));

module.exports = { db, redisClient };
