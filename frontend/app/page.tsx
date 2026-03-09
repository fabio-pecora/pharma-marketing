"use client";

import { useState } from "react";

type Claim = {
  id: number;
  claim_text: string;
  citation: string;
};

function extractText(html: string) {
  if (typeof window === "undefined") return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.innerText;
}

export default function Page() {
  const [audience, setAudience] = useState("HCP");
  const [category, setCategory] = useState("efficacy");
  const [therapeuticArea, setTherapeuticArea] = useState("Oncology");

  const [contentType, setContentType] = useState("email");
  const [goal, setGoal] = useState("education");
  const [tone, setTone] = useState("clinical");

  const [claims, setClaims] = useState<Claim[]>([]);
  const [selectedClaims, setSelectedClaims] = useState<number[]>([]);

  const [generated, setGenerated] = useState("");

  const [showRefine, setShowRefine] = useState(false);
  const [refineType, setRefineType] = useState("shorten");
  const [customPrompt, setCustomPrompt] = useState("");

  const [loading, setLoading] = useState(false);

  const selectStyle =
    "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  async function loadClaims() {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/recommended-claims?audience=${audience}&category=${category}&therapeutic_area=${therapeuticArea}`,
      );

      const data = await res.json();
      setClaims(data);
    } catch (error) {
      console.error("Failed to load claims:", error);
    }
  }

  function toggleClaim(id: number) {
    if (selectedClaims.includes(id)) {
      setSelectedClaims(selectedClaims.filter((c) => c !== id));
    } else {
      setSelectedClaims([...selectedClaims, id]);
    }
  }

  async function generate() {
    try {
      setLoading(true);

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

      setGenerated(data.html);
      setShowRefine(false);
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Generation failed. Check backend.");
    } finally {
      setLoading(false);
    }
  }

  async function refine() {
    try {
      setLoading(true);

      const textContent = extractText(generated);

      const res = await fetch("http://127.0.0.1:8000/refine-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: textContent,
          refine_type: refineType,
          instruction: customPrompt,
        }),
      });

      if (!res.ok) {
        throw new Error("Backend endpoint missing");
      }

      const data = await res.json();

      setGenerated(data.html);

      setShowRefine(false);
      setCustomPrompt("");
    } catch (error) {
      console.error("Refine failed:", error);
      alert(
        "Refine endpoint not found. You need to implement /refine-content in the backend.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}

      <div className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            Pharma Marketing Content Generator
          </h1>

          <span className="text-sm text-gray-500">
            AI Assisted Content Creation
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* CLAIM RETRIEVAL */}

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Claim Retrieval
          </h2>

          <p className="text-gray-500 text-sm mb-6">
            Select filters to retrieve compliant claims.
          </p>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Audience
              </label>

              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className={selectStyle}
              >
                <option value="HCP">HCP</option>
                <option value="Patient">Patient</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Category
              </label>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectStyle}
              >
                <option value="indication">Indication</option>
                <option value="efficacy">Efficacy</option>
                <option value="safety">Safety</option>
                <option value="dosing">Dosing</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Therapeutic Area
              </label>

              <select
                value={therapeuticArea}
                onChange={(e) => setTherapeuticArea(e.target.value)}
                className={selectStyle}
              >
                <option value="Oncology">Oncology</option>
              </select>
            </div>
          </div>

          <button
            onClick={loadClaims}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition"
          >
            Retrieve Claims
          </button>
        </div>

        {/* CLAIM LIST */}

        {claims.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Available Claims
            </h2>

            <div className="space-y-3">
              {claims.map((claim) => (
                <div
                  key={claim.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <label className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={selectedClaims.includes(claim.id)}
                      onChange={() => toggleClaim(claim.id)}
                    />

                    <span className="text-gray-800 text-sm">
                      {claim.claim_text}
                      <span className="text-gray-500 ml-1">
                        ({claim.citation})
                      </span>
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GENERATION SETTINGS */}

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Content Generation
          </h2>

          <div className="grid grid-cols-3 gap-6">
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className={selectStyle}
            >
              <option value="email">Email</option>
              <option value="website">Website</option>
              <option value="social">Social</option>
            </select>

            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className={selectStyle}
            >
              <option value="education">Education</option>
              <option value="awareness">Awareness</option>
              <option value="conversion">Conversion</option>
            </select>

            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className={selectStyle}
            >
              <option value="clinical">Clinical</option>
              <option value="empathetic">Empathetic</option>
              <option value="educational">Educational</option>
            </select>
          </div>

          <button
            disabled={selectedClaims.length === 0 || loading}
            onClick={generate}
            className={`mt-6 px-5 py-2 rounded-lg font-medium text-white ${
              selectedClaims.length === 0
                ? "bg-gray-400"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {loading ? "Generating..." : "Generate Content"}
          </button>
        </div>

        {/* GENERATED OUTPUT */}

        {generated && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Generated Content
            </h2>

            <textarea
              value={generated}
              onChange={(e) => setGenerated(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-4 text-black bg-white h-64"
            />

            <button
              onClick={() => setShowRefine(true)}
              className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg"
            >
              Modify Generated Content
            </button>

            {showRefine && (
              <div className="mt-6 border-t pt-6 space-y-4">
                <label className="text-sm font-medium text-gray-700">
                  Refine Content
                </label>

                <select
                  value={refineType}
                  onChange={(e) => setRefineType(e.target.value)}
                  className={selectStyle}
                >
                  <option value="shorten">Shorten Content</option>
                  <option value="expand">Expand Explanation</option>
                  <option value="reorganize">Reorganize Sections</option>
                  <option value="emphasize">Emphasize Key Claim</option>
                  <option value="simplify">Simplify Language</option>
                  <option value="readability">Improve Readability</option>
                </select>

                <textarea
                  placeholder="Optional custom instruction (max 300 characters)"
                  maxLength={300}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 text-black bg-white"
                />

                <button
                  onClick={refine}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
                >
                  Apply Refinement
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
