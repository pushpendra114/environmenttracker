import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import { connectToDatabase, executeQuery } from "./db.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import session from "express-session";
import multer from "multer";
import fs from "fs";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;
const publicDir = path.join(__dirname);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

// Configure session middleware
app.use(
  session({
    secret: "your-secret-key", // Replace with a strong secret key
    resave: false, // Prevents resaving session if unmodified
    saveUninitialized: false, // Do not save uninitialized sessions
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true, // Prevents client-side access to the cookie
      maxAge: 24 * 60 * 60 * 1000, // 1 day expiration
    },
  })
);

const userDetails = {
  email: null,
  name: null,
  role: null,
  password: null,
  storedOtp: null,
};

app.post("/email-verify", async (req, res) => {
  const { email } = req.body;
  try {
    const db = await connectToDatabase();
    const existingUser = await executeQuery(
      db,
      `SELECT email FROM register WHERE email = ?`,
      [email]
    );
    if (existingUser.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.json({ message: "Email is available" });
  } catch (error) {
    console.error("Email check failed:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Send OTP
app.post("/send-otp", async (req, res) => {
  const { email, name, role, password } = req.body;
  userDetails.email = email;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated OTP:", otp);
  userDetails.storedOtp = otp;

  const hashedPassword = await bcrypt.hash(password, 10);
  userDetails.name = name;
  userDetails.role = role;
  userDetails.password = hashedPassword;
  console.log("User details:", userDetails);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    port: 587,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER, // Loaded from .env
      pass: process.env.EMAIL_PASSWORD, // Loaded from .env
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER, // Loaded from .env
    to: email,
    subject: "Environment Tracker OTP Verification",
    html: `<p>Hello ${role} ${name},<br>Your OTP code is: <strong>${otp}</strong><br>Role: ${role}<br>LOVE FROM ENVIRONMENT TRACKER TEAM ❤️</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Failed to send OTP:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});


// Verify OTP and register user
app.post("/verify-otp", async (req, res) => {
  const { otp } = req.body;
  try {
    if (otp === userDetails.storedOtp) {
      console.log("Otp verified");
      const { role, email, name, password } = userDetails;

      const db = await connectToDatabase();
      await executeQuery(
        db,
        `INSERT INTO register (role, name, email, password) VALUES (?, ?, ?, ?)`,
        [role, name, email, password]
      );

      res.json({ message: "OTP verified and user registered" });
    } else {
      res.status(400).json({ message: "Invalid OTP" });
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ message: "Registration failed" });
  }
});

// Login
app.post("/login-request", async (req, res) => {
  const { email, password } = req.body;
  try {
    const db = await connectToDatabase();
    const results = await executeQuery(
      db,
      `SELECT password, role, name  FROM register WHERE email = ?`,
      [email]
    );
    console.log("Login results:", results); // Debugging log
    if (results.length > 0) {
      const match = await bcrypt.compare(password, results[0].password);
      if (match) {
        req.session.user = { email };
        req.session.user.role = results[0].role;
        req.session.user.name = results[0].name;
        console.log("Session set:", req.session);

        return res.json({ message: "Correct" });
      }
    }
    res.status(400).json({ message: "Incorrect" });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// Example: Access session data
app.get("/dashboard", async (req, res) => {
  if (req.session && req.session.user) {
    // Ensure session exists
    console.log("Session data:", req.session.user); // Debugging log
    const userEmail = req.session.user.email;

    const userName = userEmail.split("@")[0];
    const userInitial = userName.charAt(0).toUpperCase();
    res.json({
      role: req.session.user.role,
      name: req.session.user.name,
      loggedIn: true,
      message: `Welcome, ${userEmail}`,
      userInitial,
    });
  } else {
    console.log("No session found");
    res.json({
      loggedIn: false,
      message: "No session found",
    });
  }
});
// Session check API

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.status(500).send("Logout failed");
    }
    res.clearCookie("connect.sid"); // Remove session cookie
    res.json({ message: "Logged out successfully" });
  });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("Upload directory:", uploadDir);
    cb(null, uploadDir); // ✅ ADD THIS LINE!
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    console.log("Unique suffix:", uniqueSuffix); // Debugging log
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
const upload = multer({ storage: storage });

app.post("/upload", upload.single("media"), async (req, res) => {
  console.log("Body:", req.body);
  if (!req.session.user) {
    console.log("have sent error for unauthorized user");
    return res.status(401).json({ message: "Unauthorized" });
  } else {
    console.log("Session data:", req.session.user); // Debugging log
    console.log("File uploaded:", req.file); // Debugging log
    const db = await connectToDatabase();

    const sql = `INSERT INTO uploads (
      email, filename, originalname, mimetype, size,
      description, location, address, upload_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      req.session.user.email, // email
      req.file.filename, // filename
      req.file.originalname, // originalname
      req.file.mimetype, // mimetype
      req.file.size, // size
      req.body.description || "", // description
      req.body.location, // location
      req.body.address || "", // address
      new Date(), // timestamp
    ];

    console.log("SQL Query:", sql); // Debugging log
    console.log("SQL Values:", values); // Debugging log
    try {
      const result = await db.query(sql, values);
      console.log("Data inserted successfully:", result);
      res.status(200).json({
        message: "File uploaded and data saved successfully",
        filename: req.file.filename,
      });
    } catch (err) {
      console.error("Error inserting data into MySQL:", err);
      return res.status(500).json({ message: "Failed to save data to the database" });
    }
  }
});

app.get("/profile/uploads", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const db = await connectToDatabase();
    const [rows] = await db.query(
      "SELECT email, filename, mimetype, description, address FROM uploads WHERE email = ? ORDER BY upload_timestamp DESC",
      [req.session.user.email]
    );
    console.log("Query result:", rows);
    res.json(rows);
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

app.get("/api/issues/nearby", async (req, res) => {
 

  const userLat = parseFloat(req.query.lat);
  const userLng = parseFloat(req.query.lng);

  if (isNaN(userLat) || isNaN(userLng)) {
    return res.status(400).json({ message: "Invalid latitude or longitude" });
  }
  console.log("User coordinates:", userLat, userLng);
  try {
    const db = await connectToDatabase();

    const [rows] = await db.query(
      `SELECT 
  email, filename, mimetype, description, address, upload_timestamp, location,
  (
    6371 * ACOS(
      COS(RADIANS(?)) * COS(RADIANS(SUBSTRING_INDEX(location, ',', 1))) *
      COS(RADIANS(SUBSTRING_INDEX(location, ',', -1)) - RADIANS(?)) +
      SIN(RADIANS(?)) * SIN(RADIANS(SUBSTRING_INDEX(location, ',', 1)))
    )
  ) AS distance
FROM uploads
HAVING distance < 10
ORDER BY upload_timestamp DESC;
`,
      [userLat, userLng, userLat]
    );
    console.log(rows);
    res.json(rows);
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

app.get("/api/user/profile", async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const db = await connectToDatabase();
    const [rows] = await db.query(
      "SELECT name, role FROM register WHERE email = ?",
      [req.session.user.email]
    );
    console.log("User profile:", rows);
    res.json(rows[0]);
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ message: "Database error" });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
