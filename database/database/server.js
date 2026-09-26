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

// Vercel runs this file as a serverless function: a fresh request can land on a
// warm instance that already connected, or a cold one that hasn't. Caching the
// connect() promise means every request reuses the same connection instead of
// opening a new one each time.
function getDb() {
  if (!dbPromise) {
    dbPromise = client.connect().then(() => client.db())
  }
  return dbPromise
}

app.use(async (req, res, next) => {
  try {
    db = await getDb()
    next()
  } catch (err) {
    console.error("MongoDB connection error:", err)
    res.status(500).json({ error: true, message: "Database connection failed" })
  }
})

const idify = (field) => (doc) => {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return { [field]: _id, ...rest }
}

//get health status
app.get("/health", async (req, res) => {
  res.status(200).json({ status: "Online" })
})

// ------------------------------------------------ PAGES -------------------------------------------------

app.get("/", (req, res) => res.render("login"))
app.get("/register", (req, res) => res.render("register"))
app.get("/home", (req, res) => res.render("home"))
app.get("/pet", (req, res) => res.render("pet"))
app.get("/petDetail", (req, res) => res.render("petDetail"))
app.get("/petHistory", (req, res) => res.render("petHistory"))
app.get("/medicalRecord", (req, res) => res.render("medicalRecord"))
app.get("/booking", (req, res) => res.render("booking"))
app.get("/appointments", (req, res) => res.render("appointments"))
app.get("/profile", (req, res) => res.render("profile"))
app.get("/admin", (req, res) => res.render("admin"))
app.get("/doctor", (req, res) => res.render("doctor"))

// Get all collections
app.get("/tables", async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    res.json(collections.map(c => c.name));
  } catch (err) {
    console.error("Database Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get all users
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

// Register
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

// Doctor adds a medical record against one of their appointments
app.post("/insertMedRecord/:app_id", async (req, res) => {
  try {
    const { app_id } = req.params;
    const { diagnosis, treatment_detail, cost, treatment_date, treatment_time } = req.body;

    const appointment = await db.collection("appointments").findOne({ _id: new ObjectId(app_id) });

    if (!appointment) {
      return res.status(404).json({ error: true, message: "Appointment not found" });
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

// Doctor accepts a pending appointment
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

// Admin: every appointment across every patient
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

// Doctor: appointments assigned to them, across all patients
app.get("/doctorAppointments/:doc_id", async (req, res) => {
  try {
    const { doc_id } = req.params;
    const rows = await db.collection("appointments").aggregate([
      { $match: { doc_id: new ObjectId(doc_id) } },
      { $lookup: { from: "pets", localField: "pet_id", foreignField: "_id", as: "pet" } },
      { $unwind: "$pet" },
      { $lookup: { from: "users", localField: "user_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: {
          pet_id: 1, reason: 1, status: 1, app_date: 1, app_time: 1,
          pet_name: "$pet.pet_name", username: "$user.username"
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

// Admin creates a doctor account: a Doctors profile + a linked User login
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

// Vercel imports this file as a serverless function and handles the HTTP
// server itself — app.listen() is only for running this as a normal
// long-lived process (local dev, Docker).
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
