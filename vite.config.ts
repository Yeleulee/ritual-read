import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// Trigger redeployment
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_YOUTUBE_API_KEY": JSON.stringify(env.VITE_YOUTUBE_API_KEY || env.NEXT_PUBLIC_YOUTUBE_API_KEY || ""),
      "import.meta.env.NEXT_PUBLIC_YOUTUBE_API_KEY": JSON.stringify(env.NEXT_PUBLIC_YOUTUBE_API_KEY || env.VITE_YOUTUBE_API_KEY || ""),
      "import.meta.env.VITE_SUPABASE_FUNCTIONS_URL": JSON.stringify(env.VITE_SUPABASE_FUNCTIONS_URL || ""),
    },
  };
});
