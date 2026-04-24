export default async function handler(req, res) {
  // Allow your site
  const allowed = [
    'https://psa-sucks.com',
    'https://www.psa-sucks.com',
    'http://localhost:3000',
    'http://127.0.0.1'
  ];
  const origin = req.headers.origin || '';
  const isAllowed = allowed.some(o => origin.startsWith(o));

  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : 'null');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAllowed) return res.status(403).json({ error: 'Forbidden' });

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      }
    );

    const data = await geminiRes.json();
    return res.status(geminiRes.status).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
