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
  const [projectId, setProjectId] = useState<number | null>(null);

  const generated = versions.length > 0 ? versions[currentVersion] : "";

  const [showRefine, setShowRefine] = useState(false);
  const [refineOptions, setRefineOptions] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");

  const [loading, setLoading] = useState(false);

  const [claimsUsed, setClaimsUsed] = useState<Claim[]>([]);
  const [complianceReport, setComplianceReport] = useState<any>(null);

  const [retrievalAttempted, setRetrievalAttempted] = useState(false);
  const [isClaimRequest, setIsClaimRequest] = useState(false);

  const selectStyle =
    "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  async function loadClaims() {
    setRetrievalAttempted(true);
    if (category === "request_claim") {
      setClaims([]);
      return;
    }
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/recommended-claims?category=${category}&therapeutic_area=${therapeuticArea}`,
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
      setComplianceReport(null);

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
        if (data.project_id) {
          setProjectId(data.project_id);
        }

        if (data.claims_used) {
          setClaimsUsed(data.claims_used);
        }

        if (data.compliance_report) {
          setComplianceReport(data.compliance_report);
        }
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
          project_id: projectId || null,
          content: textContent,
          refine_type: refineOptions.join(", "),
          instruction: customPrompt,
          claim_ids: projectId ? selectedClaims : [],
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

      if (data.compliance_report) {
        setComplianceReport(data.compliance_report);
      }

      setShowRefine(false);
      setCustomPrompt("");
    } catch (error) {
      console.error("Refine failed:", error);
      alert("Refine failed. Check backend.");
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    if (status === "pass") return "text-green-800";
    if (status === "warning") return "text-amber-800";
    if (status === "fail") return "text-red-800";
    return "text-gray-800";
  }

  function getStatusBackground(status: string) {
    if (status === "pass") return "bg-green-50 border-green-300";
    if (status === "warning") return "bg-amber-50 border-amber-300";
    if (status === "fail") return "bg-red-50 border-red-300";
    return "bg-gray-50 border-gray-300";
  }
  function toggleRefine(option: string) {
    if (refineOptions.includes(option)) {
      setRefineOptions(refineOptions.filter((o) => o !== option));
    } else {
      setRefineOptions([...refineOptions, option]);
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

    let claimsHTML = "";

    if (claimsUsed.length > 0) {
      claimsHTML = `
        <div style="margin-top:40px;">
          <h3 style="color:#002855;">Approved Claims Used</h3>

          ${claimsUsed
            .map(
              (claim) => `
              <div style="background:#F7F2F8;border-left:4px solid #8C4799;padding:16px;margin-top:12px;border-radius:6px;">
                <div style="font-size:14px;color:#1f2937;">
                  ${claim.claim_text}
                </div>

                <div style="font-size:12px;color:#6b7280;margin-top:4px;">
                  Citation: ${claim.citation}
                </div>
              </div>
            `,
            )
            .join("")}

        </div>
      `;
    }
    const metadataHTML = `
      <div style="margin-top:40px;font-size:12px;color:#6b7280;">
        <h3 style="color:#002855;">Content Metadata</h3>

        <p><strong>Project ID:</strong> ${projectId ?? "N/A"}</p>
        <p><strong>Audience:</strong> ${audience}</p>
        <p><strong>Content Type:</strong> ${contentType}</p>
        <p><strong>Marketing Goal:</strong> ${goal}</p>
        <p><strong>Tone:</strong> ${tone}</p>
        <p><strong>Therapeutic Area:</strong> ${therapeuticArea}</p>
        <p><strong>Version:</strong> ${currentVersion + 1}</p>
        <p><strong>Total Versions:</strong> ${versions.length}</p>
        <p><strong>Export Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
      `;

    const fullHTML = `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8">
  <title>FRUZAQLA Marketing Content</title>

  <style>

  body {
  font-family: Arial, Helvetica, sans-serif;
  background:#F5F6F8;
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



  .content {
  padding:32px;
  color:#1F2937;
  line-height:1.6;
  font-size:16px;
  }

  .logo-area{
  padding:22px 28px;
  background:white;
  border-bottom:1px solid #eee;
  }

  .brand-bar{
  height:6px;
  background:#8C4799;
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
  background:#8C4799;
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

  <div class="logo-area">
  <img 
  src="https://assets-dam.takeda.com/image/upload/v1760391521/Oncology/Medicines/FRUZAQLA_Logo_PNG.png"
  style="height:60px"
  />
  </div>

<div class="brand-bar"></div>

  <div class="content">

  <div class="divider"></div>

  ${htmlContent}

  ${claimsHTML}

  ${metadataHTML}

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
            FRUZAQLA Marketing Content Generator
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

          <div className="grid grid-cols-2 gap-6">
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
                <option value="request_claim">Request New Claim</option>
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
        {!retrievalAttempted ? (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Claims Library
            </h2>

            <p className="text-gray-500">
              Approved claims will appear here after you retrieve them using the
              selected filters.
            </p>
          </div>
        ) : claims.length > 0 ? (
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
              No Approved Claims Found
            </h2>

            <p className="text-gray-500 mb-4">
              No approved claims match the selected filters. If you require a
              new claim, you can submit a request to the Medical, Legal, and
              Regulatory team.
            </p>

            <button
              onClick={requestClaimEmail}
              className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-lg"
            >
              Request New Approved Claim
            </button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Content Generation
          </h2>

          <div className="grid grid-cols-4 gap-6">
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
                <option value="CareGiver">CareGiver</option>
              </select>
            </div>
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

            {/* APPROVED CLAIMS USED */}
            {claimsUsed.length > 0 && (
              <div className="mt-6 border-t pt-6">
                <h3 className="text-md font-semibold text-gray-900 mb-3">
                  Approved Claims Used
                </h3>

                <div className="space-y-3">
                  {claimsUsed.map((claim) => (
                    <div
                      key={claim.id}
                      className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                    >
                      <div className="text-sm text-gray-800">
                        {claim.claim_text}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Citation: {claim.citation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-4">
              <button
                onClick={() => {
                  setValidationError("");
                  setShowRefine(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg"
              >
                {isClaimRequest ? "Improve Email" : "Modify Generated Content"}
              </button>

              <button
                onClick={exportHTML}
                className="bg-gray-800 hover:bg-black text-white px-5 py-2 rounded-lg"
              >
                Export HTML
              </button>
            </div>

            {/* ERROR MESSAGE */}

            {validationError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg">
                {validationError}
              </div>
            )}

            {/* REFINE UI (NOW ABOVE COMPLIANCE CHECK) */}

            {showRefine && (
              <div className="mt-6 border-t pt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    "Shorten",
                    "Expand",
                    "Reorganize",
                    "Emphasize Claim",
                    "Simplify",
                    "Improve Readability",
                  ].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleRefine(option)}
                      className={`px-3 py-1 rounded-lg border text-sm
                        ${
                          refineOptions.includes(option)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                        }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

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

            {/* COMPLIANCE REPORT */}

            {complianceReport && (
              <div className="mt-6 border-t pt-6 text-black">
                <h3 className="text-md font-semibold text-black mb-3">
                  Compliance Check
                </h3>

                <div className="space-y-3 text-sm">
                  {/* CLAIM INTEGRITY */}

                  <div
                    className={`border p-3 rounded ${getStatusBackground(
                      complianceReport.claim_integrity.status,
                    )}`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">Claim Integrity</span>
                      <span
                        className={getStatusColor(
                          complianceReport.claim_integrity.status,
                        )}
                      >
                        {complianceReport.claim_integrity.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-700 mt-1">
                      {complianceReport.claim_integrity.reason}
                    </div>
                  </div>

                  {/* CITATION CHECK */}

                  <div
                    className={`border p-3 rounded ${getStatusBackground(
                      complianceReport.citation_check.status,
                    )}`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">Citation Check</span>
                      <span
                        className={getStatusColor(
                          complianceReport.citation_check.status,
                        )}
                      >
                        {complianceReport.citation_check.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-700 mt-1">
                      {complianceReport.citation_check.reason}
                    </div>
                  </div>

                  {/* FAIR BALANCE */}

                  <div
                    className={`border p-3 rounded ${getStatusBackground(
                      complianceReport.fair_balance.status,
                    )}`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">Fair Balance</span>
                      <span
                        className={getStatusColor(
                          complianceReport.fair_balance.status,
                        )}
                      >
                        {complianceReport.fair_balance.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-700 mt-1">
                      {complianceReport.fair_balance.reason}
                    </div>
                  </div>

                  {/* OFF LABEL RISK */}

                  <div
                    className={`border p-3 rounded ${getStatusBackground(
                      complianceReport.off_label_risk.status,
                    )}`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">Off Label Risk</span>
                      <span
                        className={getStatusColor(
                          complianceReport.off_label_risk.status,
                        )}
                      >
                        {complianceReport.off_label_risk.status}
                      </span>
                    </div>

                    <div className="text-xs text-gray-700 mt-1">
                      {complianceReport.off_label_risk.reason}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {validationError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg">
                {validationError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
