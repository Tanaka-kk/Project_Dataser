db = db.getSiblingDB("appointment_db");
db.users.createIndex({ username: 1 }, { unique: true });

const doctorId = new ObjectId();

db.doctors.insertOne({
  _id: doctorId,
  doc_name: "Dr. Doctor",
  specialization: "General",
  phone: null,
  is_available: true
});

db.users.insertMany([
  {
    username: "admin",
    password: "$2b$10$BJzeDqggLq9MSCxVDP40C.DQTUv4BMDC92Z/BDZZOe0XedpR8..Bi", // "123"
    full_name: "",
    phone: "",
    role: "admin",
    doc_id: null,
    created_at: new Date()
  },
  {
    username: "doctor",
    password: "$2b$10$MgXHu0FfFYdoW6OAK6HEceJnISwArTsCTPz43SWXrJQ02ZszWGraa", // "456"
    full_name: "Dr. Doctor",
    phone: "",
    role: "doctor",
    doc_id: doctorId,
    created_at: new Date()
  }
]);
