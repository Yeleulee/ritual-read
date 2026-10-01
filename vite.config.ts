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
      // The dev server is local, so the signed-in check that guards the keys in production is skipped
      server.middlewares.use("/api/ai-chat", (req, res) => {
        void aiChatHandler(req, res, { env, requireAuth: false });
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
