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

function EmailRenderer({ html }: { html: string }) {
  const text = extractText(html);

  const subjectMatch = text.match(/Subject:(.*)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : "Generated Subject";

  const body = text.replace(/Subject:.*\n?/i, "").trim();

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700">Subject</label>

        <input
          value={subject}
          readOnly
          className="w-full border border-gray-300 rounded-lg p-3 text-black bg-white"
        />
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700">
          Email Body
        </label>

        <div className="border border-gray-300 rounded-lg p-4 text-black bg-white whitespace-pre-line">
          {body}
        </div>
      </div>
    </div>
  );
}

function SocialRenderer({ html }: { html: string }) {
  const text = extractText(html);

  // Robust hashtag extraction
  const hashtagMatches = text.match(/#[A-Za-z0-9_]+/g) || [];

  const hashtags = hashtagMatches.join(" ");

  const post = text.replace(/#[A-Za-z0-9_]+/g, "").trim();

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-gray-700">Post</label>

        <div className="border border-gray-300 rounded-lg p-4 text-black bg-white whitespace-pre-line">
          {post}
        </div>
      </div>

      <div>
        <label className="text-sm font-semibold text-gray-700">Hashtags</label>

        <div className="border border-gray-300 rounded-lg p-3 text-black bg-white">
          {hashtags}
        </div>
      </div>
    </div>
  );
}

function WebsiteRenderer({ html }: { html: string }) {
  const text = extractText(html);

  return (
    <div>
      <label className="text-sm font-semibold text-gray-700">Web Copy</label>

      <div className="border border-gray-300 rounded-lg p-4 text-black bg-white whitespace-pre-line">
        {text}
      </div>
    </div>
  );
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

  const selectStyle =
    "w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";

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
                <option value="mechanism_of_action">Mechanism of Action</option>
                <option value="clinical_study">Clinical Study</option>
                <option value="pharmacology">Pharmacology</option>
                <option value="monitoring">Monitoring</option>
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

          <p className="text-gray-500 text-sm mb-6">
            Configure generation settings.
          </p>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Content Type
              </label>

              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className={selectStyle}
              >
                <option value="email">Email</option>
                <option value="website">Website</option>
                <option value="social">Social Post</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Goal</label>

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
              <label className="text-sm font-medium text-gray-700">Tone</label>

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
            disabled={selectedClaims.length === 0}
            onClick={generate}
            className={`mt-6 px-5 py-2 rounded-lg font-medium text-white ${
              selectedClaims.length === 0
                ? "bg-gray-400"
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            Generate Content
          </button>
        </div>

        {/* GENERATED OUTPUT */}

        {generated && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-7">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Generated Content
            </h2>

            {contentType === "email" && <EmailRenderer html={generated} />}

            {contentType === "social" && <SocialRenderer html={generated} />}

            {contentType === "website" && <WebsiteRenderer html={generated} />}
          </div>
        )}
      </div>
    </div>
  );
}
