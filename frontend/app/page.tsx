"use client";

import { useState } from "react";

type Claim = {
  id: number;
  claim_text: string;
  citation: string;
};

export default function Page() {
  const [audience, setAudience] = useState("HCP");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaims, setSelectedClaims] = useState<number[]>([]);
  const [html, setHtml] = useState("");

  async function loadClaims() {
    const res = await fetch(
      `http://127.0.0.1:8000/recommended-claims?audience=${audience}`,
    );

    const data = await res.json();

    setClaims(data);
  }

  function toggleClaim(id: number) {
    if (selectedClaims.includes(id)) {
      setSelectedClaims(selectedClaims.filter((c) => c !== id));
    } else {
      setSelectedClaims([...selectedClaims, id]);
    }
  }

  async function generate() {
    if (selectedClaims.length === 0) {
      alert("Select at least one claim");
      return;
    }

    const res = await fetch("http://127.0.0.1:8000/generate-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content_type: "email",
        audience,
        goal: "education",
        tone: "clinical",
        therapeutic_area: "metastatic colorectal cancer",
        claim_ids: selectedClaims,
      }),
    });

    const data = await res.json();

    setHtml(data.html);
  }

  return (
    <div className="p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Pharma Marketing Generator</h1>

      <div className="mb-4">
        <label className="mr-2">Audience</label>

        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="border p-2"
        >
          <option value="HCP">HCP</option>
          <option value="Patient">Patient</option>
        </select>
      </div>

      <button
        onClick={loadClaims}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Get Recommended Claims
      </button>

      <div className="mt-6">
        {claims.map((claim) => (
          <div key={claim.id} className="p-3 border rounded mb-2">
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={selectedClaims.includes(claim.id)}
                onChange={() => toggleClaim(claim.id)}
              />

              <span>
                {claim.claim_text}
                <span className="text-gray-500"> ({claim.citation})</span>
              </span>
            </label>
          </div>
        ))}
      </div>

      <button
        onClick={generate}
        className="bg-green-600 text-white px-4 py-2 mt-4 rounded"
      >
        Generate Content
      </button>

      <div className="mt-8 border p-6">
        <h2 className="text-xl font-bold mb-3">HTML Preview</h2>

        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
