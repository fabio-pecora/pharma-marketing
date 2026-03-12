"use client";

import { useState } from "react";

type Claim = {
  id: number;
  claim_text: string;
  citation: string;
  image?: string | null;
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
  const [categories, setCategories] = useState<string[]>(["efficacy"]);
  const [therapeuticArea, setTherapeuticArea] = useState("Oncology");
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

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

  const [styleGuideFile, setStyleGuideFile] = useState<File | null>(null);
  type VisualAsset = {
    type: string;
    description?: string;
    url: string;
  };
  const [loadingVisualAssets, setLoadingVisualAssets] = useState(false);
  const [brandColors, setBrandColors] = useState<string[]>([]);

  const [visualAssets, setVisualAssets] = useState<VisualAsset[]>([]);
  const [selectedVisualAssets, setSelectedVisualAssets] = useState<
    VisualAsset[]
  >([]);

  const [clinicalFactsFile, setClinicalFactsFile] = useState<File | null>(null);
  const [approvedClaimsFile, setApprovedClaimsFile] = useState<File | null>(
    null,
  );
  const [loadingClaims, setLoadingClaims] = useState(false);
  const selectStyle =
    "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

  type ChatMessage = {
    role: "user" | "assistant";
    text: string;
  };

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [guidedMode, setGuidedMode] = useState(false);

  const [botThinking, setBotThinking] = useState(false);

  async function loadClaims(forcedCategories?: string[]) {
    setRetrievalAttempted(true);
    const categoriesToUse = forcedCategories || categories;

    if (categoriesToUse.length === 0) {
      alert("Please select at least one claim category.");
      return;
    }

    if (categories.includes("request_claim")) {
      setClaims([]);
      return;
    }

    try {
      const categoryQuery = categoriesToUse
        .map((c) => `categories=${c}`)
        .join("&");

      const res = await fetch(
        `http://127.0.0.1:8000/recommended-claims?${categoryQuery}&therapeutic_area=${therapeuticArea}`,
      );
      const data = await res.json();

      if (Array.isArray(data)) {
        setClaims(data);

        setTimeout(() => {
          const el = document.getElementById("available-claims");

          if (el) {
            el.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });

            // highlight animation
            el.classList.add("ring-4", "ring-blue-300");

            setTimeout(() => {
              el.classList.remove("ring-4", "ring-blue-300");
            }, 1200);
          }
        }, 300);
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
          category: categories[0],
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

  async function loadCompliance(projectId: number) {
    const res = await fetch(
      `http://127.0.0.1:8000/project-metadata/${projectId}`,
    );
    const data = await res.json();

    if (data.claims_used) {
      setClaimsUsed(data.claims_used);
    }

    if (data.compliance_report) {
      setComplianceReport(data.compliance_report);
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
          brand_colors: selectedColors,
        }),
      });

      if (!res.body) {
        throw new Error("Streaming response body is null");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let streamedText = "";
      let streamedProjectId: number | null = null;

      setVersions([""]);
      setCurrentVersion(0);

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunkText = decoder.decode(value);

        if (chunkText.startsWith("__PROJECT_ID__")) {
          const id = parseInt(chunkText.replace("__PROJECT_ID__:", "").trim());

          streamedProjectId = id;
          setProjectId(id);

          continue;
        }

        streamedText += chunkText;

        setVersions([streamedText]);
        setCurrentVersion(0);
      }
      if (streamedProjectId) {
        await loadCompliance(streamedProjectId);
      }
    } catch (error) {
      console.error("Generation failed:", error);
      alert("Generation failed. Check backend terminal.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(file: File | null, type: string) {
    if (!file) {
      alert("Please select a file first");
      return;
    }

    try {
      setLoadingClaims(true); // START LOADING

      const formData = new FormData();
      formData.append("file", file);
      formData.append("material_type", type);

      const res = await fetch("http://127.0.0.1:8000/upload-claims-file", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();

      alert(`${data.rows_inserted} rows uploaded`);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("File upload failed. Check backend.");
    } finally {
      setLoadingClaims(false); // STOP LOADING
    }
  }

  async function uploadStyleGuide() {
    if (!styleGuideFile) {
      alert("Please select a style guide PDF first.");
      return;
    }

    try {
      setLoadingVisualAssets(true);

      const formData = new FormData();
      formData.append("file", styleGuideFile);

      const res = await fetch("http://127.0.0.1:8000/upload-style-guide", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      if (data.brand_colors) {
        setBrandColors(data.brand_colors.slice(0, 5));
      }

      if (Array.isArray(data.detected_assets)) {
        const assets = data.detected_assets.map((asset: any) => ({
          type: asset.type,
          description: asset.description || "",
          url: `http://127.0.0.1:8000/visual_assets/${asset.file_path}`,
        }));

        setVisualAssets(assets);
      }
    } catch (error) {
      console.error("Style guide upload failed:", error);
      alert("Failed to process style guide.");
    } finally {
      setLoadingVisualAssets(false);
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

  async function exportHTML() {
    if (!generated) return;

    let htmlContent = generated;

    const primaryColor = selectedColors[0] || "#002855";
    const accentColor = selectedColors[1] || "#8C4799";
    const backgroundColor = selectedColors[2] || "#F5F6F8";

    let visualHTML = "";

    // ------------------------------------------------
    // EMBED LOGO AS BASE64
    // ------------------------------------------------

    const logos = selectedVisualAssets.filter((a) =>
      ["logo", "icon"].includes((a.type || "").toLowerCase()),
    );

    if (logos.length > 0) {
      try {
        const response = await fetch(logos[0].url);
        const blob = await response.blob();

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });

        visualHTML = `
          <div class="logo-area">
            <img src="${base64}" alt="brand logo" class="brand-logo"/>
          </div>
        `;
      } catch (err) {
        console.error("Logo embedding failed:", err);
      }
    }

    // ------------------------------------------------
    // CONVERT TEXT TO HTML IF NEEDED
    // ------------------------------------------------

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

    // ------------------------------------------------
    // CLAIMS SECTION
    // ------------------------------------------------

    let claimsHTML = "";

    if (claimsUsed.length > 0) {
      claimsHTML = `
        <div class="claims-section">
          <h3>Approved Claims Used</h3>

          ${claimsUsed
            .map(
              (claim) => `
            <div class="claim-box">
              <div class="claim-text">${claim.claim_text}</div>
              <div class="claim-citation">Citation: ${claim.citation}</div>
            </div>
          `,
            )
            .join("")}

        </div>
      `;
    }

    // ------------------------------------------------
    // METADATA
    // ------------------------------------------------

    const metadataHTML = `
      <div class="metadata-section">
        <h3>Content Metadata</h3>

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

    // ------------------------------------------------
    // FINAL HTML
    // ------------------------------------------------

    const fullHTML = `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8">
  <title>FRUZAQLA Marketing Content</title>

  <style>

body{
font-family:Arial, Helvetica, sans-serif;
background:${backgroundColor};
padding:40px;
margin:0;
}

.container{
max-width:640px;
margin:auto;
background:white;
border-radius:8px;
overflow:hidden;
box-shadow:0 6px 18px rgba(0,0,0,0.08);
}

/* HEADER */

.logo-area{
padding:28px;
background:white;
display:flex;
justify-content:center;
align-items:center;
border-bottom:1px solid #eee;
}

.brand-logo{
max-width:220px;
height:auto;
object-fit:contain;
}

/* BRAND COLOR STRIP */

.brand-bar{
height:8px;
background:linear-gradient(90deg, ${primaryColor}, ${accentColor});
}

/* MAIN CONTENT */

.content{
padding:36px;
color:#1F2937;
line-height:1.6;
font-size:16px;
}

/* TITLES */

h2{
color:${primaryColor};
margin-top:0;
font-size:22px;
}

h3{
color:${primaryColor};
margin-top:28px;
font-size:18px;
}

/* SECTION DIVIDER */

.divider{
height:4px;
background:${accentColor};
width:80px;
margin:18px 0;
border-radius:3px;
}

/* CLAIMS SECTION */

.claims-section{
margin-top:40px;
padding-top:10px;
border-top:1px solid #e5e7eb;
}

.claim-box{
background:#F8F9FC;
border-left:5px solid ${accentColor};
padding:16px;
margin-top:14px;
border-radius:6px;
}

.claim-text{
font-size:14px;
color:#1f2937;
}

.claim-citation{
font-size:12px;
color:#6b7280;
margin-top:4px;
}

/* METADATA */

.metadata-section{
margin-top:40px;
padding-top:16px;
border-top:1px solid #e5e7eb;
font-size:12px;
color:#6b7280;
}

/* BUTTON STYLE (for website/social exports) */

.button{
display:inline-block;
background:${primaryColor};
color:white;
padding:10px 18px;
border-radius:6px;
text-decoration:none;
font-weight:600;
margin-top:16px;
}

.button:hover{
background:${accentColor};
}

/* FOOTER */

.footer{
background:#F9FAFB;
padding:20px;
font-size:12px;
color:#6B7280;
text-align:center;
}

</style>

  </head>

  <body>

  <div class="container">

  ${visualHTML}

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

    const link = document.createElement("a");
    link.href = url;
    link.download = `${contentType}_content.html`;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }

  async function sendChat() {
    const userMessage = chatInput;
    setBotThinking(true);

    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setChatInput("");

    const res = await fetch("http://127.0.0.1:8000/guided-conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        conversation_history: chatMessages.map((m) => m.text),
      }),
    });

    const data = await res.json();
    setBotThinking(false);

    try {
      const parsed = JSON.parse(data.response);

      if (parsed.audience) setAudience(parsed.audience);
      if (parsed.content_type) setContentType(parsed.content_type);
      if (parsed.goal) setGoal(parsed.goal);
      if (parsed.tone) setTone(parsed.tone);
      if (parsed.therapeutic_area) setTherapeuticArea(parsed.therapeutic_area);

      if (parsed.claim_categories) {
        const detectedCategories = parsed.claim_categories;
        setCategories(detectedCategories);

        // CLAIM REQUEST
        if (detectedCategories.includes("request_claim")) {
          const message = `
  I couldn't find a matching approved claim category for your request.

  This system supports pharmaceutical marketing workflows using approved clinical claims.

  I will generate a request email to the Medical, Legal, and Regulatory (MLR) team so they can review whether a new claim can be created.
  `;

          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", text: message },
          ]);

          requestClaimEmail();
          return;
        }

        // NORMAL CLAIM FLOW
        const message = `Perfect! I identified the claim category as "${detectedCategories.join(
          ", ",
        )}". Matching approved claims are now loaded below. Select the ones you want and click Generate Content.`;

        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: message },
        ]);

        loadClaims(detectedCategories);
      }
    } catch (e) {
      // response was natural text
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.response },
      ]);
    }
  }

  function addClaimImage(imageBase64: string) {
    const htmlImage = `
  <div style="margin:24px 0;text-align:center;">
    <img
      src="data:image/png;base64,${imageBase64}"
      style="max-width:100%;border-radius:6px;"
    />
  </div>
  `;

    const updated = [...versions];
    let current = updated[currentVersion];

    // Convert plain text to paragraphs if needed
    if (!current.includes("<p")) {
      current = current
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => `<p>${line.trim()}</p>`)
        .join("");
    }

    const paragraphs = current.split("</p>");

    const signatureWords = [
      "best regards",
      "regards",
      "sincerely",
      "thank you",
    ];

    let insertPosition = paragraphs.length;

    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i].toLowerCase();

      if (signatureWords.some((word) => text.includes(word))) {
        insertPosition = i;
        break;
      }
    }

    paragraphs.splice(insertPosition, 0, htmlImage);

    updated[currentVersion] = paragraphs.join("</p>");

    setVersions(updated);
  }

  function formatPreview(content: string) {
    if (!content) return "";

    const looksLikeHTML =
      content.includes("<p") ||
      content.includes("<h") ||
      content.includes("<div");

    if (looksLikeHTML) return content;

    return content
      .replace(/SUBJECT:\s*(.*)/i, "<h2>$1</h2>")
      .replace(/BODY:/i, "")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => `<p>${line.trim()}</p>`)
      .join("");
  }
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            FRUZAQLA Marketing Content Generator
          </h1>

          <span className="text-sm text-gray-500">
            AI Assisted Content Creation
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div
          id="claims-section"
          className="bg-white border border-gray-200 rounded-xl shadow-sm p-7"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Upload Evidence Library
          </h2>

          <p className="text-gray-500 text-sm mb-6">
            Upload clinical facts, approved claims, and brand style guides.
          </p>

          {loadingClaims && (
            <div className="mb-6 flex items-center gap-3 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-sm font-medium">
                Extracting clinical claims from document...
              </span>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-8">
            {/* Clinical Facts Upload */}
            <div className="border-2 border-dashed border-blue-300 rounded-xl p-6 bg-blue-50 hover:bg-blue-100 transition">
              <h3 className="text-md font-semibold text-blue-800 mb-2">
                Clinical Facts
              </h3>

              <p className="text-sm text-blue-700 mb-4">
                Upload clinical studies, trial data, or supporting evidence.
              </p>

              <input
                type="file"
                accept=".csv,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setClinicalFactsFile(file);
                }}
                className="block w-full text-sm text-gray-700 mb-4"
              />

              <button
                type="button"
                disabled={loadingClaims}
                onClick={() => uploadFile(clinicalFactsFile, "clinical_fact")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition"
              >
                {loadingClaims ? "Uploading..." : "Upload Clinical Facts"}
              </button>
            </div>

            {/* Approved Claims Upload */}
            <div className="border-2 border-dashed border-green-300 rounded-xl p-6 bg-green-50 hover:bg-green-100 transition">
              <h3 className="text-md font-semibold text-green-800 mb-2">
                Approved Claims
              </h3>

              <p className="text-sm text-green-700 mb-4">
                Upload approved marketing claims from regulatory documents.
              </p>

              <input
                type="file"
                accept=".csv,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setApprovedClaimsFile(file);
                }}
                className="block w-full text-sm text-gray-700 mb-4"
              />

              <button
                type="button"
                disabled={loadingClaims}
                onClick={() => uploadFile(approvedClaimsFile, "claim")}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition"
              >
                {loadingClaims ? "Uploading..." : "Upload Approved Claims"}
              </button>
            </div>

            {/* Style Guide Upload */}
            <div className="border-2 border-dashed border-purple-300 rounded-xl p-6 bg-purple-50 hover:bg-purple-100 transition">
              <h3 className="text-md font-semibold text-purple-800 mb-2">
                Brand Style Guide
              </h3>

              <p className="text-sm text-purple-700 mb-4">
                Upload brand guideline PDF containing logos, icons or charts.
              </p>

              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setStyleGuideFile(file);
                }}
                className="block w-full text-sm text-gray-700 mb-4"
              />

              <button
                type="button"
                onClick={uploadStyleGuide}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg transition"
              >
                Upload Style Guide
              </button>
            </div>
          </div>
        </div>
        {loadingVisualAssets && (
          <div className="bg-white border border-purple-200 rounded-xl shadow-sm p-7 flex items-center gap-3 text-purple-700">
            <div className="animate-spin h-4 w-4 border-2 border-purple-600 border-t-transparent rounded-full"></div>
            <span className="text-sm font-medium">
              Extracting visual assets from brand style guide...
            </span>
          </div>
        )}
        {/* Detected Visual Assets */}
        {visualAssets.length > 0 && (
          <div
            id="claims-section"
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-7"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Detected Visual Assets
            </h2>

            <p className="text-gray-500 text-sm mb-6">
              Visual elements extracted from the uploaded brand style guide.
              Select which assets should be included in the generated content.
            </p>

            <div className="grid grid-cols-3 gap-6">
              {visualAssets.map((asset, index) => (
                <label
                  key={`${asset.url}-${index}`}
                  className="border border-gray-200 rounded-lg p-4 flex flex-col items-center gap-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="self-start"
                    checked={selectedVisualAssets.some(
                      (a) => a.url === asset.url,
                    )}
                    onChange={() => {
                      if (
                        selectedVisualAssets.some((a) => a.url === asset.url)
                      ) {
                        setSelectedVisualAssets(
                          selectedVisualAssets.filter(
                            (a) => a.url !== asset.url,
                          ),
                        );
                      } else {
                        setSelectedVisualAssets([
                          ...selectedVisualAssets,
                          asset,
                        ]);
                      }
                    }}
                  />

                  <img
                    src={asset.url}
                    alt={asset.description || "visual asset"}
                    className="w-24 border rounded-md"
                  />

                  {asset.description &&
                    typeof asset.description === "string" && (
                      <p className="text-sm text-gray-700 text-center">
                        {asset.description}
                      </p>
                    )}
                </label>
              ))}
            </div>
          </div>
        )}
        {brandColors.length > 0 && (
          <div
            id="brand-colors"
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-7"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Brand Colors
            </h2>

            <div className="flex gap-4">
              {brandColors.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    if (selectedColors.includes(color)) {
                      setSelectedColors(
                        selectedColors.filter((c) => c !== color),
                      );
                    } else {
                      setSelectedColors([...selectedColors, color]);
                    }
                  }}
                  className={`flex flex-col items-center p-2 rounded-lg border
                    ${
                      selectedColors.includes(color)
                        ? "border-blue-600 ring-2 ring-blue-300"
                        : "border-gray-300"
                    }`}
                >
                  <div
                    className="w-14 h-14 rounded-md border shadow-sm"
                    style={{ backgroundColor: color }}
                  />

                  <span className="text-xs text-gray-600 mt-1">{color}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Guided Content Creation
          </h2>

          <div className="space-y-3 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-72 overflow-y-auto">
            {chatMessages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="mr-2 text-xl">🤖</div>
                )}

                <div
                  className={`max-w-[70%] px-4 py-2 rounded-xl text-sm shadow
                  ${
                    m.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-900"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* BOT TYPING INDICATOR */}
            {botThinking && (
              <div className="flex justify-start">
                <div className="mr-2 text-xl">🤖</div>

                <div className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm shadow text-gray-500">
                  typing...
                </div>
              </div>
            )}
          </div>

          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendChat();
            }}
            placeholder="Describe the marketing content you want..."
            className="border border-gray-300 p-3 w-full rounded-lg text-black bg-white placeholder-gray-500"
          />

          <button
            onClick={sendChat}
            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
          >
            Send
          </button>
        </div>

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

              <div className="grid grid-cols-2 gap-3">
                {[
                  "efficacy",
                  "safety",
                  "dosing",
                  "mechanism_of_action",
                  "patient_population",
                  "clinical_evidence",
                ].map((cat) => {
                  const selected = categories.includes(cat);

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setIsClaimRequest(false);

                        let updated = categories.filter(
                          (c) => c !== "request_claim",
                        );

                        if (updated.includes(cat)) {
                          updated = updated.filter((c) => c !== cat);
                        } else {
                          updated = [...updated, cat];
                        }

                        setCategories(updated);
                      }}
                      className={`
                    border rounded-lg p-3 text-sm text-left transition
                    ${
                      selected
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }
                    `}
                    >
                      <div className="font-medium capitalize">{cat}</div>

                      <div className="text-xs opacity-80">
                        Approved {cat} claims
                      </div>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setCategories(["request_claim"]);
                    setSelectedClaims([]);
                    setClaims([]);
                    setIsClaimRequest(true);
                  }}
                  className={`
                  mt-2 border rounded-lg p-3 text-sm text-left transition
                  ${
                    categories.includes("request_claim")
                      ? "bg-orange-600 text-white border-orange-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }
                  `}
                >
                  <div className="font-medium">Request New Claim</div>
                  <div className="text-xs opacity-80">
                    Send request to MLR team
                  </div>
                </button>
              </div>
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
            onClick={() => loadClaims()}
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
          <div
            id="available-claims"
            className="bg-white border border-gray-200 rounded-xl shadow-sm p-7"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Available Claims
              </h2>

              <span className="text-sm text-gray-500">
                {claims.length} claims found
              </span>
            </div>

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

                  <div className="text-gray-800 text-sm">
                    <div>
                      {claim.claim_text}
                      <span className="text-gray-500 ml-1">
                        ({claim.citation})
                      </span>
                    </div>

                    {claim.image && (
                      <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        🖼 Supporting image available
                      </div>
                    )}
                  </div>
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
            <div
              className="mt-6 border rounded-lg p-8 bg-white text-gray-900 leading-relaxed max-w-2xl mx-auto"
              dangerouslySetInnerHTML={{ __html: formatPreview(generated) }}
            />
            {/* APPROVED CLAIMS USED */}
            {claimsUsed.length > 0 && (
              <div className="mt-6 border-t pt-6">
                <h3 className="text-md font-semibold text-gray-900 mb-3">
                  Approved Claims Used
                </h3>

                <div className="space-y-3">
                  {claimsUsed.map((claim, index) => (
                    <div
                      key={`${claim.id}-${index}`}
                      className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                    >
                      <div className="text-sm text-gray-800">
                        {claim.claim_text}
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        Citation: {claim.citation}
                      </div>

                      {claim.image && (
                        <div className="mt-2 space-y-2">
                          <img
                            src={`data:image/png;base64,${claim.image}`}
                            className="max-h-32 rounded border"
                          />

                          <div className="flex gap-2">
                            <button
                              onClick={() => addClaimImage(claim.image!)}
                              className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                            >
                              Insert Image
                            </button>
                          </div>
                        </div>
                      )}
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
