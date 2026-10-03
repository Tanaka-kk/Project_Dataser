/**
 * server.js — REST API ระบบนัดหมายคลินิกสัตว์ (Express + MongoDB)
 *
 * ตั้งค่าผ่าน .env:
 *   MONGO_URI    (เช่น mongodb://localhost:27017/appointment_db หรือ connection string)
 *   PORT         (ค่าเริ่มต้น 8000)
 *   VERCEL       (กำหนดโดย Vercel เมื่อรันแบบ serverless)
 *
 * Collections: users, pets, doctors, appointments, medical_records
 * ทุก id ในเส้นทาง (:user_id, :pet_id, :doc_id, :app_id, :record_id) คือ MongoDB ObjectId
 *
 * รูปแบบ error ทั่วไป:
 *   500 → { "error": true, "message": "Internal Server Error" } หรือรูปแบบเฉพาะตาม endpoint
 *
 * หมายเหตุ:
 * - รันแบบปกติ (local/Docker): เรียก app.listen()
 * - รันแบบ Vercel (serverless): export app ออกไปโดยไม่เรียก listen
 * - ใช้ middleware เชื่อมต่อ DB ก่อนทุก request ด้วยการ cache connect() promise
 */
require("dotenv").config()
const express = require("express")
const { MongoClient, ObjectId } = require("mongodb")
const cors = require("cors")
const bcrypt = require("bcrypt")
const path = require("path")
const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, "..", "..", "frontend", "public")))
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "..", "..", "frontend", "views"))

const saltRounds = 10

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI environment variable is not set")
}

const client = new MongoClient(process.env.MONGO_URI)
let db
let dbPromise

/**
 * getDb() — ดึง database instance พร้อม caching connection สำหรับ serverless
 * การทำงาน: ถ้ายังไม่เคย connect → สร้าง promise ของ client.connect() แล้วคืน db
 * เมื่อรันบน Vercel (warm instance) จะ reuse promise เดิม ไม่เปิด connection ใหม่ทุก request
 * @returns {Promise<Db>} MongoDB database instance
 */
function getDb() {
  if (!dbPromise) {
    dbPromise = client.connect().then(() => client.db())
  }
  return dbPromise
}

/**
 * DB middleware — เชื่อมต่อ MongoDB ก่อนประมวลผล request ทุกครั้ง
 * การทำงาน: await getDb() แล้วเก็บ db ไว้ใช้ใน request scope
 * ถ้าเชื่อมต่อไม่สำเร็จ → ตอบ 500 { "error": true, "message": "Database connection failed" }
 */
app.use(async (req, res, next) => {
  try {
    db = await getDb()
    next()
  } catch (err) {
    console.error("MongoDB connection error:", err)
    res.status(500).json({ error: true, message: "Database connection failed" })
  }
})

/**
 * idify(field) — แปลง _id เป็น field ที่กำหนด
 * ตัวอย่าง: rows.map(idify("user_id")) จะได้ { user_id: ..., ...rest }
 * @param {string} field - ชื่อ field ที่จะใช้แทน _id
 * @returns {function(Object|null): Object|null}
 */
const idify = (field) => (doc) => {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return { [field]: _id, ...rest }
}

// ------------------------------------------------- Check -------------------------------------------------
/**
 * GET /health — เช็คว่า server ยังทำงานอยู่
 * 200 → { "status": "Online" }
 */
app.get("/health", async (req, res) => {
  res.status(200).json({ status: "Online" })
})

// ------------------------------------------------ PAGES -------------------------------------------------

/**
 * GET / — Render หน้า login
 */
app.get("/", (req, res) => res.render("login"))
/**
 * GET /register — Render หน้าสมัครสมาชิก
 */
app.get("/register", (req, res) => res.render("register"))
/**
 * GET /home — Render หน้า Home
 */
app.get("/home", (req, res) => res.render("home"))
/**
 * GET /pet — Render หน้า Pet
 */
app.get("/pet", (req, res) => res.render("pet"))
/**
 * GET /petDetail — Render หน้า Pet Detail
 */
app.get("/petDetail", (req, res) => res.render("petDetail"))
/**
 * GET /petHistory — Render หน้า Pet History
 */
app.get("/petHistory", (req, res) => res.render("petHistory"))
/**
 * GET /medicalRecord — Render หน้า Medical Record
 */
app.get("/medicalRecord", (req, res) => res.render("medicalRecord"))
/**
 * GET /booking — Render หน้า Booking
 */
app.get("/booking", (req, res) => res.render("booking"))
/**
 * GET /appointments — Render หน้า Appointments
 */
app.get("/appointments", (req, res) => res.render("appointments"))
/**
 * GET /profile — Render หน้า Profile
 */
app.get("/profile", (req, res) => res.render("profile"))
/**
 * GET /admin — Render หน้า Admin
 */
app.get("/admin", (req, res) => res.render("admin"))
/**
 * GET /doctor — Render หน้า Doctor
 */
app.get("/doctor", (req, res) => res.render("doctor"))

/**
 * GET /tables — ดูชื่อ collection ทั้งหมดในฐานข้อมูล
 * 200 → [ "users", "pets", "doctors", "appointments", "medical_records", ... ]
 */
app.get("/tables", async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    res.json(collections.map(c => c.name));
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /users — ดึงข้อมูล user ทั้งหมด (ไม่ส่ง password กลับ)
 * 200 → [ { "user_id": "665f1c2e9a1b2c3d4e5f6789", "username": "...", "full_name": "", "phone": "", "role": "user", ... } ]
 */
app.get("/users", async (req, res) => {
  try {
    const rows = await db.collection("users")
      .find({}, { projection: { password: 0 } })
      .toArray();
    res.json(rows.map(idify("user_id")));
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ------------------------------------------------ USER -------------------------------------------------

/**
 * POST /register — สมัครสมาชิกใหม่ (role = "user")
 * การทำงาน:
 *   1. เช็คว่ากรอก username / password / confirm_password ครบ
 *   2. เช็คว่า password ตรงกับ confirm_password
 *   3. เช็คว่า username ยังไม่ถูกใช้
 *   4. เข้ารหัส password ด้วย bcrypt แล้วบันทึกลง users
 * Body: { "username": "donno", "password": "123", "confirm_password": "123" }
 * 201 → { "error": false, "message": "Registration successful!" }
 * 400 → กรอกไม่ครบ | รหัสผ่านไม่ตรงกัน | username ซ้ำ
 */
app.post("/register", async (req, res) => {
  try {
    const { username, password, confirm_password } = req.body;

    if (!username || !password || !confirm_password) {
      return res.status(400).json({
        error: true,
        message: "Username and password are required"
      });
    }

    if (password !== confirm_password) {
      return res.status(400).json({
        error: true,
        message: "Passwords do not match"
      });
    }

    const existingUser = await db.collection("users").findOne({ username });

    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: "This username is already taken"
      });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await db.collection("users").insertOne({
      username,
      password: hashedPassword,
      full_name: "",
      phone: "",
      role: "user",
      doc_id: null,
      created_at: new Date()
    });

    res.status(201).json({
      error: false,
      message: "Registration successful!"
    });

  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * POST /login — เข้าสู่ระบบ
 * การทำงาน: หา user จาก username แล้วเทียบ password กับค่าที่เข้ารหัสด้วย bcrypt
 * Body: { "username": "donno", "password": "123" }
 * 200 → { "error": false, "message": "Login successful", "user_id": "...", "username": "...", "role": "user", "doc_id": null }
 * 400 → กรอกไม่ครบ
 * 401 → username หรือ password ผิด
 */
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: true,
        message: "Username and password are required"
      });
    }

    const user = await db.collection("users").findOne({ username });

    if (!user) {
      return res.status(401).json({
        error: true,
        message: "Invalid username or password"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        error: true,
        message: "Invalid username or password"
      });
    }

    res.json({
      error: false,
      message: "Login successful",
      user_id: user._id,
      username: user.username,
      role: user.role,
      doc_id: user.doc_id
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * GET /infoUser/:user_id — ดูข้อมูลโปรไฟล์ของ user (ไม่ส่ง password กลับ)
 * 200 → { "user_id": "...", "username": "...", "full_name": "...", "phone": "..." }
 */
app.get("/infoUser/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const doc = await db.collection("users").findOne(
      { _id: new ObjectId(user_id) },
      { projection: { username: 1, full_name: 1, phone: 1 } }
    );

    res.json(idify("user_id")(doc));
  } catch (err) {
    console.error("Get User Info Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});


/**
 * PUT /updateUser/:user_id — แก้ไขข้อมูลส่วนตัวของ user
 * Body: { "full_name": "...", "phone": "..." }
 * 200 → { "error": false, "message": "User updated successfully" }
 * Note: ตอบสำเร็จเสมอ แม้ไม่พบ user_id
 */
app.put("/updateUser/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { full_name, phone } = req.body;
    await db.collection("users").updateOne(
      { _id: new ObjectId(user_id) },
      { $set: { full_name, phone } }
    );

    res.json({
      error: false,
      message: "User updated successfully"
    });
  } catch (err) {
    console.error("Update User Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

// ------------------------------------------------- PET PART -------------------------------------------------

/**
 * POST /insertPet/:user_id — เพิ่มสัตว์เลี้ยงให้ user
 * Body: { "pet_name": "...", "pet_type": "...", "pet_age": "YYYY-MM-DD" }
 * 201 → { "error": false, "message": "Pet added successfully!" }
 */
app.post("/insertPet/:user_id", async (req, res) => {
  try {
    const { pet_name, pet_type, pet_age } = req.body;
    const { user_id } = req.params;

    await db.collection("pets").insertOne({
      pet_name,
      species: pet_type,
      birth_date: pet_age ? new Date(pet_age) : null,
      user_id: new ObjectId(user_id)
    });

    res.status(201).json({
      error: false,
      message: "Pet added successfully!"
    });
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /getpets/:user_id — ดึงสัตว์เลี้ยงทั้งหมดของ user (เฉพาะ pet_name)
 * 200 → [ { "pet_id": "...", "pet_name": "..." } ]
 */
app.get("/getpets/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const rows = await db.collection("pets")
      .find({ user_id: new ObjectId(user_id) }, { projection: { pet_name: 1 } })
      .toArray();
    res.json(rows.map(idify("pet_id")));
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * GET /infopet/:pet_id — ดูข้อมูลสัตว์เลี้ยง 1 ตัว
 * 200 → { "pet_id": "...", "pet_name": "...", "species": "...", "bloodtype": "...", "birth_date": "...", "weight": ..., "allergy": "..." }
 */
app.get("/infopet/:pet_id", async (req, res) => {
  try {
    const { pet_id } = req.params;
    const doc = await db.collection("pets").findOne(
      { _id: new ObjectId(pet_id) },
      { projection: { pet_name: 1, species: 1, bloodtype: 1, birth_date: 1, weight: 1, allergy: 1 } }
    );

    res.json(idify("pet_id")(doc));
  } catch (err) {
    console.error("Get Pet Info Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * PUT /updatePet/:pet_id — แก้ไขข้อมูลสัตว์เลี้ยง
 * Body: { "pet_name": "...", "species": "...", "bloodtype": "...", "birth_date": "YYYY-MM-DD", "weight": ..., "allergy": "..." }
 * 200 → { "error": false, "message": "Pet updated successfully" }
 * 400 → Weight cannot be negative
 * Note: ตอบสำเร็จแม้ไม่พบ pet_id
 */
app.put("/updatePet/:pet_id", async (req, res) => {
  try {
    const { pet_id } = req.params;
    const { pet_name, species, bloodtype, birth_date, weight, allergy } = req.body;

    if (weight && Number(weight) < 0) {
      return res.status(400).json({
        error: true,
        message: "Weight cannot be negative"
      });
    }

    await db.collection("pets").updateOne(
      { _id: new ObjectId(pet_id) },
      { $set: {
          pet_name, species, bloodtype,
          birth_date: birth_date ? new Date(birth_date) : null,
          weight: weight ? Number(weight) : null,
          allergy
        }
      }
    );

    res.json({
      error: false,
      message: "Pet updated successfully"
    });
  } catch (err) {
    console.error("Update Pet Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * DELETE /deletePet/:pet_id — ลบสัตว์เลี้ยง
 * การทำงาน: ตรวจสอบว่ามีนัดหมายหรือประวัติการรักษาที่ผูกกับสัตว์เลี้ยงอยู่หรือไม่ ก่อนลบ
 * 200 → { "error": false, "message": "Pet deleted successfully" }
 * 500 → Cannot delete a pet with existing appointments or medical records (กรณีถูกใช้งานอยู่)
 */
app.delete("/deletePet/:pet_id", async (req, res) => {
  try {
    const petId = new ObjectId(req.params.pet_id);
    const inUse = await db.collection("appointments").findOne({ pet_id: petId })
      || await db.collection("medical_records").findOne({ pet_id: petId });

    if (inUse) {
      return res.status(500).json({
        error: true,
        message: "Cannot delete a pet with existing appointments or medical records"
      });
    }

    await db.collection("pets").deleteOne({ _id: petId });

    res.json({
      error: false,
      message: "Pet deleted successfully"
    });
  } catch (err) {
    console.error("Delete Pet Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});


// ------------------------------------------------- MEDICAL RECORDS -------------------------------------------------

/**
 * POST /insertMedRecord/:app_id — บันทึกประวัติการรักษา (ผูกกับ appointment)
 * การทำงาน: ดึงข้อมูล appointment จาก app_id แล้วบันทึกลง medical_records
 * Body: { "diagnosis": "...", "treatment_detail": "...", "cost": 500, "treatment_date": "YYYY-MM-DD", "treatment_time": "HH:MM:SS" }
 * 201 → { "error": false, "message": "Medical record added successfully!" }
 * 404 → Appointment not found
 */
app.post("/insertMedRecord/:app_id", async (req, res) => {
  try {
    const { app_id } = req.params;
    const { diagnosis, treatment_detail, cost, treatment_date, treatment_time } = req.body;

    const appointment = await db.collection("appointments").findOne({ _id: new ObjectId(app_id) });

    if (!appointment) {
      return res.status(404).json({ error: true, message: "Appointment not found" });
    }

    const existingRecord = await db.collection("medical_records").findOne({ app_id: appointment._id });

    if (existingRecord) {
      return res.status(400).json({
        error: true,
        message: "A medical record already exists for this appointment"
      });
    }

    await db.collection("medical_records").insertOne({
      pet_id: appointment.pet_id,
      doc_id: appointment.doc_id,
      app_id: appointment._id,
      diagnosis,
      treatment_detail,
      cost: cost ? Number(cost) : null,
      treatment_date: treatment_date ? new Date(treatment_date) : null,
      treatment_time
    });

    res.status(201).json({
      error: false,
      message: "Medical record added successfully!"
    });
  } catch (err) {
    console.error("Insert Medical Record Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * GET /GetMedicalRecord/:pet_id — ดึงประวัติการรักษาทั้งหมดของสัตว์เลี้ยง
 * 200 → [ { "record_id": "...", "diagnosis": "...", "treatment_date": "..." } ] (เรียงวันที่ใหม่→เก่า)
 */
app.get("/GetMedicalRecord/:pet_id", async (req, res) => {
  try {
    const { pet_id } = req.params;
    const rows = await db.collection("medical_records")
      .find({ pet_id: new ObjectId(pet_id) }, { projection: { diagnosis: 1, treatment_date: 1 } })
      .sort({ treatment_date: -1 })
      .toArray();
    res.json(rows.map(idify("record_id")));
  } catch (err) {
    console.error("Get Medical Records Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * GET /GetMedicalRecordInfo/:record_id — ดูประวัติการรักษา 1 รายการ (รวมชื่อหมอ)
 * 200 → { "record_id": "...", "diagnosis": "...", "treatment_detail": "...", "cost": ..., "treatment_date": "...", "treatment_time": "...", "doc_name": "..." }
 */
app.get("/GetMedicalRecordInfo/:record_id", async (req, res) => {
  try {
    const { record_id } = req.params;
    const rows = await db.collection("medical_records").aggregate([
      { $match: { _id: new ObjectId(record_id) } },
      { $lookup: { from: "doctors", localField: "doc_id", foreignField: "_id", as: "doctor" } },
      { $unwind: "$doctor" },
      { $project: {
          diagnosis: 1, treatment_detail: 1, cost: 1, treatment_date: 1, treatment_time: 1,
          doc_name: "$doctor.doc_name"
        }
      }
    ]).toArray();

    res.json(idify("record_id")(rows[0]));
  } catch (err) {
    console.error("Get Medical Record Info Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

// ------------------------------------------------- Appointments -------------------------------------------------

/**
 * POST /insertAppointment/:pet_id/:user_id/:doc_id — จองนัดหมาย
 * การทำงาน: ตรวจสอบวันที่ไม่ใช่อดีต แล้วบันทึกนัดลง appointments (status เริ่มต้นเป็น null)
 * Body: { "app_date": "YYYY-MM-DD", "app_time": "HH:MM:SS", "reason": "..." }
 * 201 → { "error": false, "message": "Appointment added successfully!" }
 * 400 → Appointment date cannot be in the past
 */
app.post("/insertAppointment/:pet_id/:user_id/:doc_id", async (req, res) => {
  try {
    const { pet_id, user_id, doc_id } = req.params;
    const { app_date, app_time, reason } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!app_date || new Date(app_date) < today) {
      return res.status(400).json({
        error: true,
        message: "Appointment date cannot be in the past"
      });
    }

    await db.collection("appointments").insertOne({
      pet_id: new ObjectId(pet_id),
      user_id: new ObjectId(user_id),
      doc_id: new ObjectId(doc_id),
      reason,
      status: null,
      app_date: app_date ? new Date(app_date) : null,
      app_time
    });

    res.status(201).json({
      error: false,
      message: "Appointment added successfully!"
    });
  } catch (err) {
    console.error("Insert Appointment Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * GET /GetAppointmentslist/:user_id — ดึงนัดหมายทั้งหมดของ user (รวม pet_name, doc_name)
 * 200 → [ { "app_id": "...", "pet_id": "...", "doc_id": "...", "reason": "...", "status": null, "app_date": "...", "app_time": "...", "pet_name": "...", "doc_name": "..." } ] (เรียงใหม่→เก่า)
 */
app.get("/GetAppointmentslist/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const rows = await db.collection("appointments").aggregate([
      { $match: { user_id: new ObjectId(user_id) } },
      { $lookup: { from: "pets", localField: "pet_id", foreignField: "_id", as: "pet" } },
      { $unwind: "$pet" },
      { $lookup: { from: "doctors", localField: "doc_id", foreignField: "_id", as: "doctor" } },
      { $unwind: "$doctor" },
      { $project: {
          pet_id: 1, doc_id: 1, reason: 1, status: 1, app_date: 1, app_time: 1,
          pet_name: "$pet.pet_name", doc_name: "$doctor.doc_name"
        }
      },
      { $sort: { app_date: -1, app_time: -1 } }
    ]).toArray();

    res.json(rows.map(idify("app_id")));

  } catch (err) {
    console.error("Get Appointments Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * DELETE /deleteAppointment/:app_id — ยกเลิก/ลบนัดหมาย
 * การทำงาน: ตรวจสอบว่ามี medical record ที่ผูกกับนัดนี้อยู่หรือไม่ ก่อนลบ
 * 200 → { "error": false, "message": "Appointment cancelled" }
 * 500 → Cannot cancel an appointment that already has a medical record (กรณีมี record แล้ว)
 */
app.delete("/deleteAppointment/:app_id", async (req, res) => {
  try {
    const appId = new ObjectId(req.params.app_id);
    const inUse = await db.collection("medical_records").findOne({ app_id: appId });

    if (inUse) {
      return res.status(500).json({
        error: true,
        message: "Cannot cancel an appointment that already has a medical record"
      });
    }

    await db.collection("appointments").deleteOne({ _id: appId });

    res.json({
      error: false,
      message: "Appointment cancelled"
    });
  } catch (err) {
    console.error("Delete Appointment Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * PUT /updateAppointmentStatus/:app_id — เปลี่ยนสถานะนัดหมาย
 * Body: { "status": "approved" | "rejected" | ... }
 * 200 → { "error": false, "message": "Appointment status updated" }
 * Note: ตอบสำเร็จเสมอ แม้ไม่พบ app_id
 */
app.put("/updateAppointmentStatus/:app_id", async (req, res) => {
  try {
    const { app_id } = req.params;
    const { status } = req.body;
    await db.collection("appointments").updateOne(
      { _id: new ObjectId(app_id) },
      { $set: { status } }
    );

    res.json({
      error: false,
      message: "Appointment status updated"
    });
  } catch (err) {
    console.error("Update Appointment Status Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * GET /GetAllAppointments — ดึงนัดหมายทั้งหมด (Admin) รวม username, pet_name, doc_name
 * 200 → [ { "app_id": "...", "username": "...", "pet_name": "...", "doc_name": "...", "reason": "...", "status": ..., "app_date": "...", "app_time": "..." } ] (เรียงใหม่→เก่า)
 */
app.get("/GetAllAppointments", async (req, res) => {
  try {
    const rows = await db.collection("appointments").aggregate([
      { $lookup: { from: "users", localField: "user_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $lookup: { from: "pets", localField: "pet_id", foreignField: "_id", as: "pet" } },
      { $unwind: "$pet" },
      { $lookup: { from: "doctors", localField: "doc_id", foreignField: "_id", as: "doctor" } },
      { $unwind: "$doctor" },
      { $project: {
          username: "$user.username", pet_name: "$pet.pet_name", doc_name: "$doctor.doc_name",
          reason: 1, status: 1, app_date: 1, app_time: 1
        }
      },
      { $sort: { app_date: -1, app_time: -1 } }
    ]).toArray();

    res.json(rows.map(idify("app_id")));
  } catch (err) {
    console.error("Get All Appointments Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * GET /doctorAppointments/:doc_id — ดึงนัดหมายทั้งหมดของหมอ (เรียงตามวันที่เวลา)
 * 200 → [ { "app_id": "...", "pet_id": "...", "reason": "...", "status": ..., "app_date": "...", "app_time": "...", "pet_name": "...", "username": "..." } ] (เรียงเก่า→ใหม่)
 */
app.get("/doctorAppointments/:doc_id", async (req, res) => {
  try {
    const { doc_id } = req.params;
    const rows = await db.collection("appointments").aggregate([
      { $match: { doc_id: new ObjectId(doc_id) } },
      { $lookup: { from: "pets", localField: "pet_id", foreignField: "_id", as: "pet" } },
      { $unwind: "$pet" },
      { $lookup: { from: "users", localField: "user_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $lookup: { from: "medical_records", localField: "_id", foreignField: "app_id", as: "records" } },
      { $project: {
          pet_id: 1, reason: 1, status: 1, app_date: 1, app_time: 1,
          pet_name: "$pet.pet_name", username: "$user.username",
          has_record: { $gt: [{ $size: "$records" }, 0] }
        }
      },
      { $sort: { app_date: 1, app_time: 1 } }
    ]).toArray();

    res.json(rows.map(idify("app_id")));
  } catch (err) {
    console.error("Get Doctor Appointments Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

// ------------------------------------------------- Doctor -------------------------------------------------

/**
 * GET /GetDoctors — ดึงรายชื่อหมอทั้งหมด
 * 200 → [ { "doc_id": "...", "doc_name": "...", "specialization": "...", "phone": "...", "is_available": true } ]
 */
app.get("/GetDoctors", async (req, res) => {
  try {
    const rows = await db.collection("doctors").find({}).toArray();
    res.json(rows.map(idify("doc_id")));
  } catch (err) {
    console.error("Get Doctors Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * POST /admin/addDoctor — สร้างบัญชีหมอ (Admin)
 * การทำงาน:
 *   1. ตรวจสอบข้อมูลที่จำเป็น (username, password, doc_name, specialization)
 *   2. ตรวจสอบ username ไม่ซ้ำ
 *   3. สร้าง doctors document
 *   4. สร้าง users document ผูกกับ doctor (role = "doctor")
 * Body: { "username": "...", "password": "...", "doc_name": "...", "specialization": "...", "phone": "..." }
 * 201 → { "error": false, "message": "Doctor account created successfully!" }
 * 400 → ข้อมูลไม่ครบ | username ซ้ำ
 */
app.post("/admin/addDoctor", async (req, res) => {
  try {
    const { username, password, doc_name, specialization, phone } = req.body;

    if (!username || !password || !doc_name || !specialization) {
      return res.status(400).json({
        error: true,
        message: "Username, password, name and specialization are required"
      });
    }

    const existingUser = await db.collection("users").findOne({ username });

    if (existingUser) {
      return res.status(400).json({
        error: true,
        message: "This username is already taken"
      });
    }

    const docResult = await db.collection("doctors").insertOne({
      doc_name, specialization, phone: phone || null, is_available: true
    });

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await db.collection("users").insertOne({
      username,
      password: hashedPassword,
      full_name: doc_name,
      phone: phone || "",
      role: "doctor",
      doc_id: docResult.insertedId,
      created_at: new Date()
    });

    res.status(201).json({
      error: false,
      message: "Doctor account created successfully!"
    });
  } catch (err) {
    console.error("Add Doctor Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * PUT /updateDoctor/:doc_id — แก้ไขข้อมูลหมอ
 * Body: { "doc_name": "...", "specialization": "...", "phone": "...", "is_available": true/false }
 * 200 → { "error": false, "message": "Doctor updated successfully" }
 * Note: ตอบสำเร็จเสมอ แม้ไม่พบ doc_id
 */
app.put("/updateDoctor/:doc_id", async (req, res) => {
  try {
    const { doc_id } = req.params;
    const { doc_name, specialization, phone, is_available } = req.body;
    await db.collection("doctors").updateOne(
      { _id: new ObjectId(doc_id) },
      { $set: { doc_name, specialization, phone, is_available: !!is_available } }
    );

    res.json({
      error: false,
      message: "Doctor updated successfully"
    });
  } catch (err) {
    console.error("Update Doctor Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * DELETE /deleteDoctor/:doc_id — ลบหมอ
 * การทำงาน: ตรวจสอบว่ามีนัดหมายหรือประวัติการรักษาที่ผูกกับหมออยู่หรือไม่ ก่อนลบ
 *           ลบทั้ง doctors และ users ที่ผูกกับหมอนี้
 * 200 → { "error": false, "message": "Doctor deleted successfully" }
 * 500 → Cannot delete a doctor with existing appointments or medical records (กรณีถูกใช้งานอยู่)
 */
app.delete("/deleteDoctor/:doc_id", async (req, res) => {
  try {
    const docId = new ObjectId(req.params.doc_id);
    const inUse = await db.collection("appointments").findOne({ doc_id: docId })
      || await db.collection("medical_records").findOne({ doc_id: docId });

    if (inUse) {
      return res.status(500).json({
        error: true,
        message: "Cannot delete a doctor with existing appointments or medical records"
      });
    }

    await db.collection("users").deleteOne({ doc_id: docId });
    await db.collection("doctors").deleteOne({ _id: docId });

    res.json({
      error: false,
      message: "Doctor deleted successfully"
    });
  } catch (err) {
    console.error("Delete Doctor Error:", err);
    res.status(500).json({
      error: true,
      message: "Internal Server Error"
    });
  }
});

/**
 * Error middleware — จับ error ที่หลุดออกมาจาก route
 * การทำงาน: อ่าน err.status แล้วตอบข้อความที่ตรงกับ status นั้น (ไม่รู้จัก → ใช้ของ 500)
 * ตัวอย่าง: 404 → { "Message": "ไม่รู้จัก Route ที่เรียกใช้ครับ", "code": 404 }
 */
app.use((err, req, res, next) => {
    console.error(err);

    const status = err.status || 500;

    const messages = {
        400: { Message: "ส่งข้อมูลมาไม่ถูก pattern", code: 400 },
        404: { Message: "ไม่รู้จัก Route ที่เรียกใช้ครับ", code: 404 },
        405: { Message: "Method ไม่ถูกต้องครับ", Status: 405 },
        500: { Message: "Internal Server Error", Status: 500 },
        502: { Message: "Bad Gateway", Status: 502 },
        503: { Message: "Service Unavailable", Status: 503 },
        504: { Message: "Gateway Timeout", Status: 504 }
    };

    res.status(status).json(messages[status] || messages[500]);
});

// เริ่ม server ที่ PORT (ค่าเริ่มต้น 8000) รับทุก network interface
// หมายเหตุ: Vercel จัดการ HTTP server เอง → ข้าม app.listen() เมื่อรันบน Vercel
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 8000

  getDb().then(() => {
    app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`))
  }).catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
}

module.exports = app;
