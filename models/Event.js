module.exports = (db) => {
  async function createEventsTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        referrer TEXT,
        device VARCHAR(50),
        ip_address VARCHAR(45),
        metadata JSON,
        app_id INT NOT NULL,
        timestamp DATETIME NOT NULL,
        FOREIGN KEY (app_id) REFERENCES api_keys(id) ON DELETE CASCADE
      )
    `);
    console.log("Events table is ready.");
  }

  createEventsTable();

  return {
    async insertEvent(data) {
      try {
        let timestamp = data.timestamp;

        if (timestamp && timestamp.endsWith("Z")) {
          timestamp = timestamp.slice(0, -1);
        }

        const date = new Date(timestamp);
        timestamp = date.toISOString().slice(0, 19).replace("T", " ");

        await db.query(
          `INSERT INTO events (event, url, referrer, device, ip_address, metadata, app_id, timestamp) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.event,
            data.url,
            data.referrer,
            data.device,
            data.ipAddress,
            JSON.stringify(data.metadata),
            data.appId,
            timestamp,
          ]
        );
      } catch (error) {
        console.error("Error inserting event:", error);
        throw error;
      }
    },

    async countEvents(query) {
      try {
        const [rows] = await db.query(
          "SELECT COUNT(*) AS count FROM events WHERE event = ?",
          [query.event]
        );
        return rows[0].count;
      } catch (error) {
        console.error("Error counting events:", error);
        throw error;
      }
    },

    async getEventSummary({ event, startDate, endDate, appId }) {
      try {
        let query = `
          SELECT COUNT(*) AS count, COUNT(DISTINCT ip_address) AS uniqueUsers, device 
          FROM events WHERE event = ?`;
        let queryParams = [event];

        if (startDate) {
          query += " AND timestamp >= ?";
          queryParams.push(`${startDate} 00:00:00`);
        }
        if (endDate) {
          query += " AND timestamp <= ?";
          queryParams.push(`${endDate} 23:59:59`);
        }
        if (appId) {
          query += " AND app_id = ?";
          queryParams.push(parseInt(appId, 10));
        }

        const [rows] = await db.query(query, queryParams);

        if (!rows.length) return null;

        const deviceData = rows.reduce((acc, row) => {
          acc[row.device] = (acc[row.device] || 0) + 1;
          return acc;
        }, {});

        return {
          event,
          count: rows[0].count,
          uniqueUsers: rows[0].uniqueUsers,
          deviceData,
        };
      } catch (error) {
        console.error("Error fetching event summary:", error);
        throw error;
      }
    },
  };
};
