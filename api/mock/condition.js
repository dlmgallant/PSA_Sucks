// api/mock/condition.js
//
// Mock endpoint for partner integration testing.
// Returns schema-shaped sample data. Makes no model calls, costs nothing.
//
// Deploys automatically to: https://<your-domain>/api/mock/condition
//
// Test key: sk_mock_misprint_2026

const MOCK_KEYS = new Set(["sk_mock_misprint_2026"]);

// Fixtures cycle so the integration sees a realistic range of responses
// rather than the same payload every time.
const FIXTURES = [
  {
    photo_quality: { sufficient: true, issues: [] },
    assessment: {
      centering: {
        severity: "none",
        notes:
          "The card is well centered front and back. Borders are even on all four sides.",
      },
      surface: {
        severity: "none",
        notes:
          "The surface is clean with no scratches or print defects. The holo is bright and even.",
      },
      edges: {
        severity: "none",
        notes: "Edges are crisp with no whitening or nicks along any side.",
      },
      corners: {
        severity: "none",
        notes: "All four corners are sharp with no softening or fraying.",
      },
    },
    overall: {
      tier: "Near Mint",
      summary:
        "This card is in excellent shape with no meaningful flaws visible. It presents like it came straight out of a pack. Nothing here would give a buyer pause.",
    },
  },
  {
    photo_quality: { sufficient: true, issues: [] },
    assessment: {
      centering: {
        severity: "minor",
        notes:
          "Slightly off-center — the left border reads a bit wider than the right. Not obvious unless you look for it.",
      },
      surface: {
        severity: "minor",
        notes:
          "The holo area is vibrant. A few light scratches show up when the card is tilted under a light source, which is common on holo surfaces.",
      },
      edges: {
        severity: "minor",
        notes:
          "Edges are generally clean with some minor whitening along the sides. Subtle, but worth noting.",
      },
      corners: {
        severity: "minor",
        notes:
          "Corners are mostly sharp with slight fraying on the bottom right. Minimal and typical of light handling.",
      },
    },
    overall: {
      tier: "Lightly Played",
      summary:
        "This card shows small signs of handling but presents well. The holo is bright and there are no creases or major defects. Nothing that would surprise a buyer expecting a played copy.",
    },
  },
  {
    photo_quality: { sufficient: true, issues: [] },
    assessment: {
      centering: {
        severity: "moderate",
        notes:
          "Noticeably off-center left to right. The right border is roughly twice the width of the left.",
      },
      surface: {
        severity: "moderate",
        notes:
          "Several visible scratches across the artwork, plus a scuff near the lower third. The holo pattern is dulled in places.",
      },
      edges: {
        severity: "moderate",
        notes:
          "Whitening is visible along the top and right edges without needing to tilt the card.",
      },
      corners: {
        severity: "severe",
        notes:
          "The top left corner is noticeably rounded and shows heavy whitening. The other three show moderate wear.",
      },
    },
    overall: {
      tier: "Moderately Played",
      summary:
        "This card has been handled a fair bit. Corner and edge wear is visible at a glance and the surface has picked up scratches. Still fully intact with no creases, but clearly a played copy.",
    },
  },
  {
    photo_quality: {
      sufficient: false,
      issues: ["too_blurry", "glare"],
    },
    assessment: {
      centering: {
        severity: "none",
        notes: "Borders appear even, though the image is too soft to be certain.",
      },
      surface: {
        severity: "none",
        notes:
          "Glare across the holo area makes it impossible to assess surface condition reliably.",
      },
      edges: {
        severity: "none",
        notes: "Edges cannot be evaluated at this image resolution.",
      },
      corners: {
        severity: "none",
        notes: "Corners are too soft in the image to assess.",
      },
    },
    overall: {
      tier: "Near Mint",
      summary:
        "The photos provided are not sharp enough for a reliable assessment. A clearer, glare-free shot would give a much more accurate read.",
    },
  },
];

let counter = 0;

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({
      error: { code: "method_not_allowed", message: "Use POST." },
    });
  }

  const key = req.headers["x-api-key"];
  if (!key || !MOCK_KEYS.has(key)) {
    return res.status(401).json({
      error: {
        code: "unauthorized",
        message: "Missing or invalid X-API-Key header.",
      },
    });
  }

  const body = req.body || {};
  const images = body.images;

  if (!Array.isArray(images)) {
    return res.status(400).json({
      error: {
        code: "invalid_image_count",
        message: "Expected an 'images' array with 2 or 4 items.",
      },
    });
  }

  if (images.length !== 2 && images.length !== 4) {
    return res.status(400).json({
      error: {
        code: "invalid_image_count",
        message: `Expected 2 or 4 images, received ${images.length}.`,
      },
    });
  }

  const views = images.map((i) => i && i.view);
  for (const required of ["front", "back"]) {
    if (!views.includes(required)) {
      return res.status(400).json({
        error: {
          code: "missing_view",
          message: `Missing required view: ${required}.`,
        },
      });
    }
  }

  const allowedViews = ["front", "back", "angle_1", "angle_2"];
  const allowedMime = ["image/jpeg", "image/png", "image/webp"];
  for (const img of images) {
    if (!img || !allowedViews.includes(img.view)) {
      return res.status(400).json({
        error: {
          code: "invalid_image",
          message: `view must be one of: ${allowedViews.join(", ")}.`,
        },
      });
    }
    if (!img.data || typeof img.data !== "string") {
      return res.status(400).json({
        error: {
          code: "invalid_image",
          message: `Missing base64 'data' for view '${img.view}'.`,
        },
      });
    }
    if (!allowedMime.includes(img.mime_type)) {
      return res.status(400).json({
        error: {
          code: "invalid_image",
          message: `mime_type must be one of: ${allowedMime.join(", ")}.`,
        },
      });
    }
  }

  // Force a specific fixture during testing with { "mock_scenario": 0..3 }
  const idx =
    Number.isInteger(body.mock_scenario) &&
    body.mock_scenario >= 0 &&
    body.mock_scenario < FIXTURES.length
      ? body.mock_scenario
      : counter++ % FIXTURES.length;

  const fixture = FIXTURES[idx];

  return res.status(200).json({
    request_id: "req_mock_" + Math.random().toString(36).slice(2, 10),
    reference_id: body.reference_id ?? null,
    schema_version: "1.0",
    ...fixture,
  });
}

export const config = {
  api: { bodyParser: { sizeLimit: "20mb" } },
};
