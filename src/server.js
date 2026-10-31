const env = require("./config/env");
const connectDatabase = require("./config/db");
const app = require("./app");
const { ensureDefaultSuperAdmin } = require("./services/adminBootstrapService");

async function startServer() {
  try {
    await connectDatabase();
    await ensureDefaultSuperAdmin();
    app.listen(env.port, () => {
      console.log(`Backend running at http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();
