const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("Set MONGO_URI first, e.g.:\n  MONGO_URI=\"mongodb+srv://...\" node seed-admin.js");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  await db.collection("users").createIndex({ username: 1 }, { unique: true });

  const existing = await db.collection("users").findOne({ username: "admin" });
  if (existing) {
    console.log("admin already exists, skipping");
  } else {
    await db.collection("users").insertOne({
      username: "admin",
      password: "$2b$10$5zTlJyqLRB5c2/vOFSdMyOH6mXODfrwv1tZEjTAi3viW9aoAwesMy", // "123"
      full_name: "",
      phone: "",
      role: "admin",
      doc_id: null,
      created_at: new Date()
    });
    console.log("admin created: username=admin password=123");
  }

  await client.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
