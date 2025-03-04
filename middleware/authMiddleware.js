module.exports = (db) => {
  return {
    async verifyApiKey(req, res, next) {
      console.log("Headers Received:", req.headers);

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "API key required" });
      }

      let apiKey = authHeader.split(" ")[1].trim();
      apiKey = apiKey.replace(/^"|"$/g, "");

      console.log("Extracted API Key:", apiKey);

      const [rows] = await db.query(
        "SELECT * FROM api_keys WHERE api_key = ? AND revoked = 0",
        [apiKey]
      );

      console.log("API Key Query Result:", rows);

      if (rows.length === 0) {
        return res.status(403).json({ error: "Invalid API key" });
      }

      req.appId = rows[0].id;
      next();
    },
  };
};
