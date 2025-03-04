module.exports = (db) => {
  async function createApiKeysTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          id INT AUTO_INCREMENT PRIMARY KEY,
          api_key VARCHAR(255) UNIQUE NOT NULL,
          app_name VARCHAR(255) NOT NULL,
          revoked BOOLEAN DEFAULT FALSE
        )
      `);
    console.log("api_keys table created.");
  }
  return {
    async insertApiKey(key, appName) {
      await db.query("INSERT INTO api_keys (api_key, app_name) VALUES (?, ?)", [
        key,
        appName,
      ]);
    },
    async findApiKey(appName) {
      const [rows] = await db.query(
        "SELECT * FROM api_keys WHERE app_name = ? AND revoked = FALSE",
        [appName]
      );
      return rows[0];
    },
    async revokeApiKey(key) {
      await db.query("UPDATE api_keys SET revoked = TRUE WHERE api_key = ?", [
        key,
      ]);
    },
    async findApiKeyByKey(apiKey) {
      console.log("Checking API Key:", apiKey);
      const [rows] = await db.query(
        "SELECT * FROM api_keys WHERE api_key = ?",
        [apiKey]
      );
      console.log("Query Result:", rows);
      return rows[0];
    },
  };
};
