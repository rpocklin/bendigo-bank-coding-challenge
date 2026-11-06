import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QuotePage } from "./QuotePage.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing root element.");
}

createRoot(root).render(
  <StrictMode>
    <QuotePage />
  </StrictMode>,
);
