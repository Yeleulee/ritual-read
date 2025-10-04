import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initFirebaseAnalytics } from "@/lib/firebase";

// Fire-and-forget analytics init
initFirebaseAnalytics();

createRoot(document.getElementById("root")!).render(<App />);
