// Vercel Serverless Proxy API: Kroki Diagram Rendering Engine
// Forwards diagram sources to Kroki (https://kroki.io) and returns rendered SVG / PNG graphics.

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let type = 'mermaid';
    let format = 'svg';
    let source = '';

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      type = (body.type || 'mermaid').toLowerCase().replace(/^kroki-/, '');
      format = (body.format || 'svg').toLowerCase();
      source = body.source || body.diagram_source || body.code || '';
    } else if (req.method === 'GET') {
      type = (req.query.type || 'mermaid').toLowerCase().replace(/^kroki-/, '');
      format = (req.query.format || 'svg').toLowerCase();
      source = req.query.source || req.query.code || '';
    }

    if (!source || !source.trim()) {
      return res.status(400).json({ error: 'Missing diagram source code.' });
    }

    // Map common engine aliases
    const typeMapping = {
      'mermaid': 'mermaid',
      'plantuml': 'plantuml',
      'graphviz': 'graphviz',
      'dot': 'graphviz',
      'blockdiag': 'blockdiag',
      'seqdiag': 'seqdiag',
      'actdiag': 'actdiag',
      'nwdiag': 'nwdiag',
      'packetdiag': 'packetdiag',
      'rackdiag': 'rackdiag',
      'c4': 'c4plantuml',
      'c4plantuml': 'c4plantuml',
      'erd': 'erd',
      'nomnoml': 'nomnoml',
      'svgbob': 'svgbob',
      'wavedrom': 'wavedrom',
      'vegalite': 'vegalite',
      'vega': 'vega',
      'excalidraw': 'excalidraw',
      'bytefield': 'bytefield',
      'ditaa': 'ditaa',
      'bpmn': 'bpmn',
      'wbs': 'plantuml'
    };

    const krokiType = typeMapping[type] || type;

    // Send POST request directly to Kroki.io API
    const krokiUrl = `https://kroki.io/${krokiType}/${format}`;
    const krokiResponse = await fetch(krokiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': format === 'png' ? 'image/png' : 'image/svg+xml'
      },
      body: source
    });

    if (!krokiResponse.ok) {
      const errText = await krokiResponse.text();
      console.error(`Kroki API error (${krokiResponse.status}):`, errText);
      return res.status(krokiResponse.status).json({
        error: 'Kroki rendering failed',
        details: errText || krokiResponse.statusText
      });
    }

    if (format === 'png') {
      const buffer = await krokiResponse.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(Buffer.from(buffer));
    } else {
      const svgText = await krokiResponse.text();
      res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.status(200).send(svgText);
    }
  } catch (error) {
    console.error('Kroki Proxy Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error while rendering diagram via Kroki.',
      details: error.message
    });
  }
}
