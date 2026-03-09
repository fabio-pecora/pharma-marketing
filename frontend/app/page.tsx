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

  let text = div.innerText;

  // remove markdown stars
  text = text.replace(/\*\*/g, "");
  text = text.replace(/\*\*\*\*/g, "");
  text = text.replace(/\*/g, "");

  return text.trim();
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

  // VERSION HISTORY
  const [versions, setVersions] = useState<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState(0);
  const [validationError, setValidationError] = useState("");

  const generated = versions.length > 0 ? versions[currentVersion] : "";

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

      if (Array.isArray(data)) {
        setClaims(data);
      } else {
        setClaims([]);
      }
    } catch (error) {
      console.error("Failed to load claims:", error);
      setClaims([]);
    }
  }

  async function requestClaimEmail() {
    try {
      const res = await fetch("http://127.0.0.1:8000/draft-claim-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audience,
          category,
          therapeutic_area: therapeuticArea,
        }),
      });

      const data = await res.json();

      if (data.email) {
        setVersions([data.email]);
        setCurrentVersion(0);
      }
    } catch (error) {
      console.error("Failed to generate email:", error);
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
    if (selectedClaims.length === 0) {
      alert(
        "Please select at least one approved claim before generating content.",
      );
      return;
    }

    try {
      setLoading(true);
      setValidationError("");

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

      // VERY IMPORTANT: log backend response
      console.log("Backend response:", data);

      // HANDLE ERROR FROM BACKEND
      if (data.error) {
        console.error("Backend error:", data.error);
        setValidationError(data.error);
        setVersions([]);
        return;
      }

      // HANDLE SUCCESS
      if (data.html) {
        setVersions([data.html]);
        setCurrentVersion(0);
        setShowRefine(false);
        setValidationError("");
      }

      // IF NOTHING RETURNED
      if (!data.html && !data.error) {
        console.error("Unexpected response:", data);
        alert("Unexpected backend response. Check console.");
      }
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Generation failed. Check backend terminal.");
    } finally {
      setLoading(false);
    }
  }
  async function refine() {
    try {
      setLoading(true);
      setValidationError("");

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
          claim_ids: selectedClaims,
        }),
      });

      const data = await res.json();

      if (data.error) {
        setValidationError(data.error);
        return;
      }

      setValidationError("");

      const newVersions = [...versions, data.html];
      setVersions(newVersions);
      setCurrentVersion(newVersions.length - 1);

      setShowRefine(false);
      setCustomPrompt("");
    } catch (error) {
      console.error("Refine failed:", error);
      alert("Refine failed. Check backend.");
    } finally {
      setLoading(false);
    }
  }

  function updateCurrentVersion(value: string) {
    const updated = [...versions];
    updated[currentVersion] = value;
    setVersions(updated);
  }

  function exportHTML() {
    if (!generated) return;

    let htmlContent = generated;

    const looksLikeHTML =
      htmlContent.includes("<p") ||
      htmlContent.includes("<h") ||
      htmlContent.includes("<div");

    if (!looksLikeHTML) {
      htmlContent = htmlContent
        .replace(/SUBJECT:\s*(.*)/i, "<h2>$1</h2>")
        .replace(/POST:/i, "<h3>Post</h3>")
        .replace(/HASHTAGS:/i, "<h3>Hashtags</h3>")
        .replace(/BODY:/i, "")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => `<p>${line.trim()}</p>`)
        .join("");
    }

    const fullHTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>FRUZAQLA Marketing Content</title>

<style>

body {
font-family: Arial, Helvetica, sans-serif;
background:#F3F4F6;
padding:40px;
margin:0;
}

.container {
max-width:640px;
margin:auto;
background:white;
border-radius:8px;
overflow:hidden;
box-shadow:0 4px 14px rgba(0,0,0,0.08);
}

.header {
background:#8C4799;
color:white;
padding:20px;
font-size:20px;
font-weight:600;
}

.content {
padding:32px;
color:#1F2937;
line-height:1.6;
font-size:16px;
}

h2 {
color:#002855;
margin-top:0;
}

h3 {
color:#002855;
margin-top:24px;
}

.divider {
height:4px;
background:#59C8E8;
width:80px;
margin:16px 0;
}

.footer {
background:#F9FAFB;
padding:20px;
font-size:12px;
color:#6B7280;
}

</style>

</head>

<body>

<div class="container">

<div class="header">
FRUZAQLA Marketing Content
</div>

<div class="content">

<div class="divider"></div>

${htmlContent}

</div>

<div class="footer">
Generated using compliant claim-based AI content generation.
</div>

</div>

</body>
</html>
`;

    const blob = new Blob([fullHTML], { type: "text/html" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${contentType}_content.html`;

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-100">
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
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Claim Retrieval
          </h2>

          <p className="text-gray-500 text-sm mb-6">
            Select filters to retrieve compliant claims.
          </p>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Claim Category
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
          >
            Retrieve Claims
          </button>
        </div>
        {claims.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Available Claims
            </h2>

            <div className="space-y-3">
              {claims.map((claim) => (
                <label
                  key={claim.id}
                  className="flex gap-3 border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
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
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              No Claims Found
            </h2>

            <p className="text-gray-500 mb-4">
              No claim generated / No claim match filters
            </p>

            <button
              onClick={requestClaimEmail}
              className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-lg"
            >
              Draft Claim Request Email
            </button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Content Generation
          </h2>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content Type
              </label>

              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className={selectStyle}
              >
                <option value="email">Email</option>
                <option value="website">Website</option>
                <option value="social">Social</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marketing Goal
              </label>

              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className={selectStyle}
              >
                <option value="education">Education</option>
                <option value="awareness">Awareness</option>
                <option value="conversion">Conversion</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tone
              </label>

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
          </div>
          <button
            disabled={selectedClaims.length === 0 || loading}
            onClick={generate}
            className={`mt-6 px-5 py-2 rounded-lg text-white
            ${
              selectedClaims.length === 0 || loading
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {loading ? "Generating..." : "Generate Content"}
          </button>
        </div>

        {generated && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Generated Content
            </h2>

            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-500">
                Version {currentVersion + 1} of {versions.length}
              </div>

              <div className="flex gap-2">
                <button
                  disabled={currentVersion === 0}
                  onClick={() => setCurrentVersion(currentVersion - 1)}
                  className="px-4 py-2 bg-white border border-gray-400 rounded-md text-gray-800 font-medium hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
                >
                  ← Previous
                </button>

                <button
                  disabled={currentVersion === versions.length - 1}
                  onClick={() => setCurrentVersion(currentVersion + 1)}
                  className="px-4 py-2 bg-white border border-gray-400 rounded-md text-gray-800 font-medium hover:bg-gray-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
                >
                  Next →
                </button>
              </div>
            </div>

            <textarea
              value={generated}
              onChange={(e) => updateCurrentVersion(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-4 text-black bg-white h-64"
            />
            <div className="flex gap-4 mt-4">
              <button
                onClick={() => {
                  setValidationError("");
                  setShowRefine(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg"
              >
                Modify Generated Content
              </button>

              <button
                onClick={exportHTML}
                className="bg-gray-800 hover:bg-black text-white px-5 py-2 rounded-lg"
              >
                Export HTML
              </button>
            </div>

            {validationError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg">
                {validationError}
              </div>
            )}
            {showRefine && (
              <div className="mt-6 border-t pt-6 space-y-4">
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
                  placeholder="Optional custom instruction"
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
