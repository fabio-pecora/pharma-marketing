"use client";

import { useState } from "react";

type Claim = {
  id: number;
  claim_text: string;
  citation: string;
};

export default function Page() {
  const [audience, setAudience] = useState("HCP");
  const [contentType, setContentType] = useState("email");
  const [goal, setGoal] = useState("education");
  const [tone, setTone] = useState("clinical");
  const [therapeuticArea, setTherapeuticArea] = useState("");

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

    if (!therapeuticArea) {
      alert("Please enter a therapeutic area");
      return;
    }

    const res = await fetch("http://127.0.0.1:8000/generate-content", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content_type: contentType,
        audience: audience,
        goal: goal,
        tone: tone,
        therapeutic_area: therapeuticArea,
        claim_ids: selectedClaims,
      }),
    });

    const data = await res.json();

    if (data.html) {
      setHtml(data.html);
    } else {
      alert("Content generation failed");
    }
  }

  return (
    <div className="p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Pharma Marketing Generator</h1>

      {/* Audience */}
      <div className="mb-4">
        <label className="mr-2 font-medium">Audience</label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="border p-2 bg-white text-black"
        >
          <option value="HCP">HCP</option>
          <option value="Patient">Patient</option>
        </select>
      </div>

      {/* Content Type */}
      <div className="mb-4">
        <label className="mr-2 font-medium">Content Type</label>
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="border p-2 bg-white text-black"
        >
          <option value="email">Email</option>
          <option value="website">Website</option>
          <option value="social">Social Post</option>
        </select>
      </div>

      {/* Goal */}
      <div className="mb-4">
        <label className="mr-2 font-medium">Goal</label>
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="border p-2 bg-white text-black"
        >
          <option value="education">Education</option>
          <option value="awareness">Awareness</option>
          <option value="conversion">Conversion</option>
        </select>
      </div>

      {/* Tone */}
      <div className="mb-4">
        <label className="mr-2 font-medium">Tone</label>
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="border p-2 bg-white text-black"
        >
          <option value="clinical">Clinical</option>
          <option value="empathetic">Empathetic</option>
          <option value="educational">Educational</option>
        </select>
      </div>

      {/* Therapeutic Area */}
      <div className="mb-4">
        <label className="mr-2 font-medium">Therapeutic Area</label>
        <input
          type="text"
          value={therapeuticArea}
          onChange={(e) => setTherapeuticArea(e.target.value)}
          placeholder="e.g. metastatic colorectal cancer"
          className="border p-2 w-full bg-white text-black"
        />
      </div>

      {/* Get Claims */}
      <button
        onClick={loadClaims}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Get Recommended Claims
      </button>

      {/* Claims */}
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

      {/* Generate */}
      <button
        onClick={generate}
        className="bg-green-600 text-white px-4 py-2 mt-4 rounded"
      >
        Generate Content
      </button>

      {/* Preview */}
      <div className="mt-8 border p-6">
        <h2 className="text-xl font-bold mb-3">HTML Preview</h2>

        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
