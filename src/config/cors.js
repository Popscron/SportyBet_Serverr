const cors = require("cors");

const ALLOWED_ORIGINS = [
  "https://admingh.online",
  "https://www.admingh.online",
  "https://spindict.com",
  "https://www.spindict.com",
  "https://spindict.vercel.app",
  "https://spindict-*.vercel.app",
  "https://*.vercel.app",
  "https://1win-web.vercel.app",
  "https://1win-web-*.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5177",
  "http://localhost:5008",
];

function originMatches(allowed, origin) {
  if (allowed.includes("*")) {
    const pattern = allowed.replace("*", ".*");
    return new RegExp(`^${pattern}$`).test(origin);
  }
  return allowed === origin;
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.some((allowed) => originMatches(allowed, origin));
}

/**
 * OPTIONS preflight — must run before cors() middleware.
 */
function mountOptionsHandler(app) {
  app.options("*", (req, res) => {
    const origin = req.headers.origin;
    if (isOriginAllowed(origin)) {
      res.header("Access-Control-Allow-Origin", origin || "*");
      res.header("Access-Control-Allow-Credentials", "true");
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, Accept, Origin"
      );
    }
    res.sendStatus(200);
  });
}

function mountCors(app) {
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
      exposedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      preflightContinue: false,
      optionsSuccessStatus: 200,
    })
  );
}

function applyCors(app) {
  mountOptionsHandler(app);
  mountCors(app);
}

module.exports = {
  ALLOWED_ORIGINS,
  applyCors,
  isOriginAllowed,
};
