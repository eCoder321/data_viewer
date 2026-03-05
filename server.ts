import express from "express";
import { createServer as createViteServer } from "vite";
import { OAuth2Client } from "google-auth-library";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cookieParser());
app.use(express.json());

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID || "MISSING_CLIENT_ID",
  process.env.GOOGLE_CLIENT_SECRET || "MISSING_CLIENT_SECRET",
  `${process.env.APP_URL || "http://localhost:3000"}/auth/callback`
);

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: { 
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasApiKey: !!process.env.GOOGLE_API_KEY,
    appUrl: process.env.APP_URL
  }});
});

app.get("/api/auth/google/url", (req, res) => {
  console.log("Generating auth URL...");
  try {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error("Missing Google OAuth credentials");
      return res.status(500).json({ error: "Missing Google OAuth credentials in environment" });
    }
    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/spreadsheets",
      ],
      prompt: "consent",
    });
    console.log("Auth URL generated successfully");
    res.json({ url });
  } catch (error) {
    console.error("Error generating auth URL:", error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code provided");

  try {
    const { tokens } = await client.getToken(code as string);
    
    // Store tokens in a secure cookie
    res.cookie("google_access_token", tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 3600 * 1000, // 1 hour
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging code:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/auth/google/token", (req, res) => {
  const token = req.cookies.google_access_token;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  res.json({ token, apiKey: process.env.GOOGLE_API_KEY });
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static("dist"));
  app.get("*", (req, res) => {
    res.sendFile("dist/index.html", { root: "." });
  });
}

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
