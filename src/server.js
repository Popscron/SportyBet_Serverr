require("dotenv").config();

const path = require("path");
const fs = require("fs");
const { getPort } = require("./config/env");
const { connectDatabase } = require("./config/database");
const { createApp } = require("./createApp");

async function startServer() {
  const uploadsDir = path.join(__dirname, "..", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  try {
    await connectDatabase();
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }

  const app = createApp({ serverless: false });
  const PORT = getPort();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { startServer };

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
