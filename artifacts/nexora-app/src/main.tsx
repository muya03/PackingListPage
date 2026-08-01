import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// The application booted, so the "could not load" notice in index.html has
// nothing to report. It is only ever seen when this module fails to run.
document.getElementById("boot-fallback")?.remove();
