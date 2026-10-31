const mongoose = require("mongoose");
const connectDatabase = require("../config/db");
const { ensureDefaultSuperAdmin } = require("../services/adminBootstrapService");

async function seedSuperAdmin() {
  await connectDatabase();
  await ensureDefaultSuperAdmin();
  console.log("Super admin seed completed.");
}

module.exports = seedSuperAdmin;

if (require.main === module) {
  seedSuperAdmin()
    .then(async () => {
      await mongoose.connection.close();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Failed to seed super admin", error);
      if (mongoose.connection.readyState !== 0) {
        try {
          await mongoose.connection.close();
        } catch (closeError) {
          console.error("Failed to close database connection", closeError);
        }
      }
      process.exit(1);
    });
}