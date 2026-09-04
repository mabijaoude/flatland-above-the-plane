import { createRoot } from "react-dom/client";
import "@fontsource/besley/latin-500.css";
import "@fontsource/besley/latin-600.css";
import "@fontsource/besley/latin-700.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-500.css";
import "@fontsource/source-sans-3/latin-600.css";
import "./styles.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
