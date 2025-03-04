module.exports = (db) => {
  const express = require("express");
  const router = express.Router();
  const crypto = require("crypto");
  const ApiKey = require("../models/ApiKey")(db);
  const passport = require("../config/googleAuth");
  router.post("/register", async (req, res) => {
    const { appName } = req.body;
    if (!appName) return res.status(400).json({ error: "App name required" });

    const key = crypto.randomBytes(32).toString("hex");
    await ApiKey.insertApiKey(key, appName);
    res.json({ apiKey: key });
  });
  router.get("/api-key", async (req, res) => {
    const { appName } = req.query;
    const apiKey = await ApiKey.findApiKey(appName);
    if (!apiKey) return res.status(404).json({ error: "API key not found" });

    res.json({ apiKey: apiKey.api_key });
  });

  router.post("/revoke", async (req, res) => {
    console.log("Received request:", req.body);
    const { apiKey } = req.body;

    if (!apiKey) return res.status(400).json({ error: "API key required" });

    await ApiKey.revokeApiKey(apiKey);
    res.json({ message: "API key revoked" });
  });

  router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  router.get(
    "/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/login-failed",
      session: false,
    }),
    (req, res) => {
      res.json({ message: "Google Auth Successful", user: req.user });
    }
  );
  router.get("/logout", (req, res) => {
    req.logout(() => {
      res.json({ message: "Logged out" });
    });
  });

  return router;
};
