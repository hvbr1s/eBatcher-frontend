"use client";

import { useState } from "react";
import { EBatcher7984Demo } from "./_components/EBatcher7984Demo";
import { EWETHDemo } from "./_components/EWETHDemo";

export default function Home() {
  const [activeDemo, setActiveDemo] = useState<"eweth" | "batcher">("eweth");

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      {/* Demo Selector */}
      <div className="window mb-3">
        <div className="title-bar">
          <div className="title-bar-text">FHE ToolKit</div>
        </div>
        <div className="window-body">
          <p style={{ marginBottom: "12px", fontSize: "12px" }}>Select your tool:</p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className={`btn ${activeDemo === "eweth" ? "btn-primary" : ""}`}
              onClick={() => setActiveDemo("eweth")}
              style={{ flex: 1 }}
            >
              eWETH (Encrypted Wrapped ETH)
            </button>
            <button
              className={`btn ${activeDemo === "batcher" ? "btn-primary" : ""}`}
              onClick={() => setActiveDemo("batcher")}
              style={{ flex: 1 }}
            >
              eBatcher (Batch Transfers)
            </button>
          </div>
        </div>
      </div>

      {/* Active Demo */}
      {activeDemo === "eweth" ? <EWETHDemo /> : <EBatcher7984Demo />}
    </div>
  );
}
