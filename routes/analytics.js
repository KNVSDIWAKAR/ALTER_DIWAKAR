module.exports = (db, redisClient) => {
  const express = require("express");
  const router = express.Router();
  const Event = require("../models/Event")(db);
  const useragent = require("useragent");

  async function validateApiKey(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "API key required" });
    }

    let apiKey = authHeader.split(" ")[1].trim().replace(/^"|"$/g, "");

    const [rows] = await db.query("SELECT id FROM api_keys WHERE api_key = ?", [
      apiKey,
    ]);
    if (rows.length === 0) {
      return res.status(403).json({ error: "Invalid API key" });
    }

    req.appId = rows[0].id;
    next();
  }

  router.post("/collect", validateApiKey, async (req, res) => {
    const { event, url, referrer, device, ipAddress, timestamp, metadata } =
      req.body;
    if (!event || !url || !timestamp) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const updatedMetadata = { ...metadata };
    if (!updatedMetadata.browser) {
      const agent = useragent.parse(req.headers["user-agent"]);
      updatedMetadata.browser = agent.family;
      updatedMetadata.os = agent.os.toString();
      updatedMetadata.device = agent.device.toString();
    }

    try {
      await Event.insertEvent({
        event,
        url,
        referrer,
        device,
        ipAddress,
        timestamp,
        metadata: updatedMetadata,
        appId: req.appId,
      });

      // Clear cached data when a new event is inserted
      await redisClient.del(`event-summary:${req.appId}:${event}`);
      await redisClient.del(`userStats:${req.appId}`);

      res.json({ message: "Event recorded" });
    } catch (err) {
      console.error("Error inserting event:", err);
      res.status(500).json({ error: "Failed to record event" });
    }
  });

  router.get("/event-summary", validateApiKey, async (req, res) => {
    try {
      const { event } = req.query;
      const appId = req.appId;
      const cacheKey = `event-summary:${appId}:${event}`;

      // Check Redis cache first
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log("✅ Cache Hit - Returning Cached Data");
        return res.json(JSON.parse(cachedData));
      }

      console.log(
        "🔍 Fetching event summary for appId:",
        appId,
        "event:",
        event
      );

      // SQL to get total event count & unique users
      const sqlQuery = `
        SELECT COUNT(*) as count, COUNT(DISTINCT ip_address) as uniqueUsers
        FROM events
        WHERE app_id = ? AND event = ?
      `;

      // SQL to get device-wise event count
      const deviceQuery = `
        SELECT device, COUNT(*) as count
        FROM events
        WHERE app_id = ? AND event = ?
        GROUP BY device
      `;

      console.log("📌 Executing SQL:", sqlQuery);
      console.log("📌 Executing SQL:", deviceQuery);

      const [[summary]] = await db.query(sqlQuery, [appId, event]);
      const [deviceRows] = await db.query(deviceQuery, [appId, event]);

      if (!summary || summary.count === 0) {
        return res.json({ message: "❌ No events found" });
      }

      // Format device data
      const deviceData = {};
      deviceRows.forEach((row) => {
        deviceData[row.device] = row.count;
      });

      const responseData = {
        event: event,
        count: summary.count,
        uniqueUsers: summary.uniqueUsers,
        deviceData: deviceData,
      };

      // Store the response in Redis cache for 5 minutes
      await redisClient.setEx(cacheKey, 300, JSON.stringify(responseData));

      res.json(responseData);
    } catch (error) {
      console.error("❌ Error fetching event summary:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/user-stats", validateApiKey, async (req, res) => {
    try {
      const appId = req.appId;

      console.log(`🔍 Fetching user stats for appId: ${appId}`);

      const totalEventsQuery = `SELECT COUNT(*) as totalEvents FROM events WHERE app_id = ?`;
      const [[totalEventsRow]] = await db.query(totalEventsQuery, [appId]);

      const latestEventQuery = `
        SELECT ip_address, metadata
        FROM events
        WHERE app_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
      `;
      const [[latestEventRow]] = await db.query(latestEventQuery, [appId]);

      if (!latestEventRow) {
        return res.json({ message: "No events found for this app." });
      }

      let metadata = latestEventRow.metadata;

      if (typeof metadata === "string") {
        try {
          metadata = JSON.parse(metadata);
        } catch (error) {
          console.warn("Failed to parse metadata, using raw data.");
          metadata = {};
        }
      } else if (typeof metadata !== "object" || metadata === null) {
        metadata = {};
      }

      const deviceDetails = {
        browser: metadata.browser || "Unknown",
        os: metadata.os || "Unknown",
      };

      res.json({
        appName: req.query.appName || "Unknown",
        totalEvents: totalEventsRow.totalEvents,
        deviceDetails,
        ipAddress: latestEventRow.ip_address,
      });
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return router;
};
