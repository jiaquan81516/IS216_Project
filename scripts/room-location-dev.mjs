import process from "node:process";
import { loadEnv } from "vite";

// Literal import paths, so Vite bundles these handlers with its config; a path built at run time
// would be looked up from the wrong folder.
const LOADERS = {
  "/api/rooms/location": () => import("../api/rooms/location.js"),
  "/api/rooms/search": () => import("../api/rooms/search.js"),
  "/api/rooms/notify": () => import("../api/rooms/notify.js"),
};

export function roomLocationDev() {
  return {
    name: "room-location-api",
    apply: "serve",
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, "");
      for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "ONEMAP_TOKEN", "ONEMAP_EMAIL", "ONEMAP_PASSWORD"]) {
        if (!process.env[key] && env[key]) process.env[key] = env[key];
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        const load = LOADERS[url.pathname];
        if (!load) return next();
        try {
          req.query = Object.fromEntries(url.searchParams);
          // Vercel parses a JSON body before the handler runs; here it has to be read by hand.
          if (req.method === "POST") {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            try {
              req.body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
            } catch {
              req.body = {};
            }
          }
          const { default: handler } = await load();
          await handler(req, res);
        } catch (error) {
          console.error("[rooms dev api]", error?.message);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ code: "server/unavailable", message: "The address lookup server could not start. Check its configuration." }));
        }
      });
    },
  };
}
