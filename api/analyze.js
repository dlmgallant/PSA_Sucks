module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    var incoming = req.body;
    var contents = incoming.contents || [];
    var contentParts = [];

    for (var i = 0; i < contents.length; i++) {
      var parts = contents[i].parts || [];
      for (var j = 0; j < parts.length; j++) {
        var part = parts[j];
        if (part.text) {
          contentParts.push({ type: "text", text: part.text });
        } else if (part.inlineData) {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: "data:" + part.inlineData.mimeType + ";base64," + part.inlineData.data,
              detail: "high"
            }
          });
        }
      }
    }

    var openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + process.env.OPENAI_KEY
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 1500,
        messages: [{ role: "user", content: contentParts }]
      })
    });

    if (!openaiRes.ok) {
      var err = await openaiRes.json().catch(function() { return {}; });
      return res.status(openaiRes.status).json({ error: err.error || "OpenAI error" });
    }

    var data = await openaiRes.json();
    var text = "No response received.";
    if (data.choices && data.choices[0] && data.choices[0].message) {
      text = data.choices[0].message.content;
    }

    return res.status(200).json({
      candidates: [{ content: { parts: [{ text: text }] } }]
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb"
    }
  }
}
