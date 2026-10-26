import process from "node:process";
import { loadEnv } from "vite";

export function roomLocationDev() {
  return {
    name: "room-location-api",
    apply: "serve",
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, "");
      for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "ONEMAP_TOKEN"]) {
        if (!process.env[key] && env[key]) process.env[key] = env[key];
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname !== "/api/rooms/location") return next();
        try {
          req.query = Object.fromEntries(url.searchParams);
          const { default: handler } = await import("../api/rooms/location.js");
          await handler(req, res);
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ code: "server/unavailable", message: "The address lookup server could not start. Check its configuration." }));
        }
      });
    },
  };
}
