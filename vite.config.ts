import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import aiChatHandler from "./api/ai-chat";

/* Serves the Vercel functions in /api from the dev server, so server-only secrets in .env (the
   Gemini keys) are used locally without ever reaching the browser bundle. */
function devApi(env: Record<string, string>): Plugin {
  return {
    name: "ritual-dev-api",
    configureServer(server) {
      // The server listens on every interface (host "::"), so only requests from this machine skip
      // the signed-in check that guards the keys; anyone else on the network must be signed in
      server.middlewares.use("/api/ai-chat", (req, res) => {
        const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
        void aiChatHandler(req, res, { env, requireAuth: !local });
      });
    },
  };
}

// https://vitejs.dev/config/
// Trigger redeployment
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger(), devApi(env)].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Only the proxy URL is exposed; the YouTube key lives solely in the edge function secret.
      "import.meta.env.VITE_SUPABASE_FUNCTIONS_URL": JSON.stringify(env.VITE_SUPABASE_FUNCTIONS_URL || ""),
    },
  };
});
