// api/analyze.js — hardened
//
// Changes from previous version:
//   - CORS locked to known origins (was "*")
//   - API key required for non-browser (partner) callers
//   - Origin check for browser traffic from psa-sucks.com
//   - Image count and payload validation
//   - Client identity returned in logs for usage tracking

const ALLOWED_ORIGINS = [
  "https://psa-sucks.com",
  "https://www.psa-sucks.com",
];

// Partner keys. Set in Vercel env vars as a comma-separated list:
//   PARTNER_KEYS=misprint:sk_live_abc123,other:sk_live_def456
function loadPartnerKeys() {
  const raw = process.env.PARTNER_KEYS || "";
  const map = new Map();
  raw.split(",").forEach((pair) => {
    const [name, key] = pair.split(":");
    if (name && key) map.set(key.trim(), name.trim());
  });
  return map;
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ~4MB per image, base64 decoded

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // --- Authorization -------------------------------------------------
  // Two valid callers:
  //   1. A browser on psa-sucks.com (identified by Origin header)
  //   2. A partner server presenting a valid X-API-Key
  const apiKey = req.headers["x-api-key"];
  const partnerKeys = loadPartnerKeys();
  let client = null;

  if (apiKey && partnerKeys.has(apiKey)) {
    client = partnerKeys.get(apiKey);
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    client = "psa-sucks-web";
  } else {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const incoming = req.body;
    if (!incoming || !Array.isArray(incoming.contents)) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const contentParts = [];
    let textBuffer = "";
    let imageCount = 0;

    for (const content of incoming.contents) {
      const parts = content.parts || [];
      for (const part of parts) {
        if (part.text) {
          textBuffer += part.text + "\n";
        } else if (part.inlineData) {
          imageCount++;
          if (imageCount > MAX_IMAGES) {
            return res
              .status(400)
              .json({ error: `Too many images (max ${MAX_IMAGES})` });
          }

          const data = part.inlineData.data || "";
          // base64 decodes to roughly 3/4 its encoded length
          if (data.length * 0.75 > MAX_IMAGE_BYTES) {
            return res.status(400).json({ error: "Image too large" });
          }

          const mime = part.inlineData.mimeType;
          if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
            return res.status(400).json({ error: "Unsupported image type" });
          }

          if (textBuffer.trim()) {
            contentParts.push({ type: "text", text: textBuffer.trim() });
            textBuffer = "";
          }
          contentParts.push({
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${data}`,
              detail: "high",
            },
          });
        }
      }
    }

    if (textBuffer.trim()) {
      contentParts.push({ type: "text", text: textBuffer.trim() });
    }

    if (imageCount === 0) {
      return res.status(400).json({ error: "At least one image required" });
    }

    // Usage line — shows up in Vercel logs, greppable for billing
    console.log(
      JSON.stringify({
        event: "analyze",
        client,
        images: imageCount,
        ts: new Date().toISOString(),
      })
    );

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1500,
        messages: [
          {
            role: "system",
            content:
              "You are an expert trading card analyst. You will be shown photos of trading cards. Always analyze the actual images provided — never say you cannot see the images. Follow the formatting instructions in the user message exactly.",
          },
          { role: "user", content: contentParts },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.json().catch(() => ({}));
      console.error("OpenAI error", openaiRes.status, err);
      // Don't leak provider error details to the caller
      return res.status(502).json({ error: "Analysis service unavailable" });
    }

    const data = await openaiRes.json();
    const text =
      data.choices?.[0]?.message?.content || "No response received.";

    return res.status(200).json({
      candidates: [{ content: { parts: [{ text }] } }],
    });
  } catch (err) {
    console.error("analyze handler error", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};
