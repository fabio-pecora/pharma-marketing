"use client";

import { useState } from "react";

type Claim = {
  id: number;
  claim_text: string;
  citation: string;
};

export default function Page() {
  const [audience, setAudience] = useState("HCP");
  const [category, setCategory] = useState("efficacy");
  const [therapeuticArea, setTherapeuticArea] = useState("Oncology");

  const [contentType, setContentType] = useState("email");
  const [goal, setGoal] = useState("education");
  const [tone, setTone] = useState("clinical");

  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaims, setSelectedClaims] = useState<number[]>([]);
  const [html, setHtml] = useState("");

  async function loadClaims() {
    const res = await fetch(
      `http://127.0.0.1:8000/recommended-claims?audience=${audience}&category=${category}&therapeutic_area=${therapeuticArea}`,
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
        content_type: contentType,
        audience,
        goal,
        tone,
        therapeutic_area: therapeuticArea,
        claim_ids: selectedClaims,
      }),
    });

    const data = await res.json();

    setHtml(data.html);
  }

  return (
    <div className="p-10 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Pharma Marketing Generator</h1>

      {/* Audience */}
      <div className="mb-4">
        <label className="mr-2">Audience</label>

        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="border p-2 bg-white text-black"
        >
          <option value="HCP">HCP</option>
          <option value="Patient">Patient</option>
        </select>
      </div>

      {/* Category */}
      <div className="mb-4">
        <label className="mr-2">Category</label>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border p-2 bg-white text-black"
        >
          <option value="efficacy">Efficacy</option>
          <option value="safety">Safety</option>
          <option value="dosing">Dosing</option>
          <option value="mechanism_of_action">Mechanism of Action</option>
          <option value="clinical_evidence">Clinical Evidence</option>
        </select>
      </div>

      {/* Therapeutic Area */}
      <div className="mb-4">
        <label className="mr-2">Therapeutic Area</label>

        <select
          value={therapeuticArea}
          onChange={(e) => setTherapeuticArea(e.target.value)}
          className="border p-2 bg-white text-black"
        >
          <option value="Oncology">Oncology</option>
          <option value="Cardiology">Cardiology</option>
          <option value="Neurology">Neurology</option>
          <option value="Immunology">Immunology</option>
          <option value="Endocrinology">Endocrinology</option>
          <option value="Gastroenterology">Gastroenterology</option>
          <option value="Infectious Diseases">Infectious Diseases</option>
          <option value="Respiratory">Respiratory</option>
          <option value="Dermatology">Dermatology</option>
          <option value="Rare Diseases">Rare Diseases</option>
        </select>
      </div>

      {/* Content Type */}
      <div className="mb-4">
        <label className="mr-2">Content Type</label>

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
        <label className="mr-2">Goal</label>

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
        <label className="mr-2">Tone</label>

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
