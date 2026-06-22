/**
 * Rocket Fuel — Claude AI Integration
 * Uses @anthropic-ai/sdk to extract plan specs and normalize bid documents.
 */

const Anthropic = require('@anthropic-ai/sdk');

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Extract plan specification data points from PDF text.
 * Returns structured JSON with confidence scores per field.
 */
async function extractPlanSpecs(pdfText) {
  const client = getClient();

  const prompt = `You are a construction plan analyst. Extract key specification data from the following plan document text.

Return ONLY a valid JSON object with this exact structure. For each field include a "value" and a "confidence" score (0-100) based on how clearly the information was stated in the document. If you cannot find a value, set value to null and confidence to 0.

{
  "total_sqft_conditioned": {"value": <number or null>, "confidence": <0-100>},
  "total_sqft_unconditioned": {"value": <number or null>, "confidence": <0-100>},
  "bedrooms": {"value": <number or null>, "confidence": <0-100>},
  "bathrooms": {"value": <number or null>, "confidence": <0-100>},
  "exterior_doors": {"value": <number or null>, "confidence": <0-100>},
  "interior_doors": {"value": <number or null>, "confidence": <0-100>},
  "windows": {"value": <number or null>, "confidence": <0-100>},
  "cabinet_linear_feet": {"value": <number or null>, "confidence": <0-100>},
  "countertop_sqft": {"value": <number or null>, "confidence": <0-100>},
  "garage_type": {"value": <string or null>, "confidence": <0-100>},
  "roof_type": {"value": <string or null>, "confidence": <0-100>},
  "roof_pitch": {"value": <string or null>, "confidence": <0-100>},
  "foundation_type": {"value": <string or null>, "confidence": <0-100>},
  "stories": {"value": <number or null>, "confidence": <0-100>},
  "finish_notes": {"value": <string or null>, "confidence": <0-100>}
}

Document text:
${pdfText.slice(0, 80000)}

Return only the JSON object, no markdown, no explanation.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  let raw = message.content[0].text.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Attempt to extract JSON from the response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('Claude did not return valid JSON for plan extraction');
    }
  }

  // Flag any field with confidence < 80
  for (const key of Object.keys(parsed)) {
    if (parsed[key] && typeof parsed[key] === 'object' && 'confidence' in parsed[key]) {
      parsed[key].flagged = parsed[key].confidence < 80;
    }
  }

  return parsed;
}

/**
 * Normalize a bid document into a standard template with line items.
 * Returns structured JSON with confidence scores per field.
 */
async function normalizeBid(documentText, fileType, vendorName, projectName) {
  const client = getClient();

  const prompt = `You are a construction bid analyst. Normalize the following ${fileType} bid document from vendor "${vendorName || 'Unknown Vendor'}" for project "${projectName || 'Unknown Project'}" into a standard template.

Return ONLY a valid JSON object with this exact structure. For each field include a "value" and a "confidence" score (0-100). If you cannot find a value set value to null and confidence to 0. Dates must be in YYYY-MM-DD format.

{
  "trade": {"value": <string>, "confidence": <0-100>},
  "bid_date": {"value": <"YYYY-MM-DD" or null>, "confidence": <0-100>},
  "bid_expiration_date": {"value": <"YYYY-MM-DD" or null>, "confidence": <0-100>},
  "grand_total": {"value": <number or null>, "confidence": <0-100>},
  "subtotal": {"value": <number or null>, "confidence": <0-100>},
  "tax": {"value": <number or null>, "confidence": <0-100>},
  "exclusions": {"value": <string or null>, "confidence": <0-100>},
  "clarifications": {"value": <string or null>, "confidence": <0-100>},
  "line_items": [
    {
      "description": {"value": <string>, "confidence": <0-100>},
      "quantity": {"value": <number or null>, "confidence": <0-100>},
      "unit": {"value": <string or null>, "confidence": <0-100>},
      "unit_price": {"value": <number or null>, "confidence": <0-100>},
      "line_total": {"value": <number or null>, "confidence": <0-100>}
    }
  ]
}

Document text:
${documentText.slice(0, 80000)}

Return only the JSON object, no markdown, no explanation.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  let raw = message.content[0].text.trim();
  // Strip markdown code fences if present
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw new Error('Claude did not return valid JSON for bid normalization');
    }
  }

  // Flag summary fields with confidence < 80
  const summaryKeys = ['trade', 'bid_date', 'bid_expiration_date', 'grand_total', 'subtotal', 'tax', 'exclusions', 'clarifications'];
  for (const key of summaryKeys) {
    if (parsed[key] && typeof parsed[key] === 'object' && 'confidence' in parsed[key]) {
      parsed[key].flagged = parsed[key].confidence < 80;
    }
  }

  // Flag line item fields with confidence < 80
  if (Array.isArray(parsed.line_items)) {
    for (const item of parsed.line_items) {
      for (const key of Object.keys(item)) {
        if (item[key] && typeof item[key] === 'object' && 'confidence' in item[key]) {
          item[key].flagged = item[key].confidence < 80;
        }
      }
    }
  }

  return parsed;
}

/**
 * Compare a confirmed bid against the baseline estimate and generate a report.
 */
async function compareBidToBaseline(bidSummary, baselineEstimate) {
  const client = getClient();

  const prompt = `You are a construction cost analyst. Compare this bid against a baseline estimate and provide analysis.

Baseline Estimate:
${JSON.stringify(baselineEstimate, null, 2)}

Submitted Bid:
${JSON.stringify(bidSummary, null, 2)}

Return ONLY a valid JSON object:
{
  "variance_analysis": <string — brief narrative of key variances>,
  "risk_flags": [<string>, ...],
  "recommendation": <string>,
  "completeness_score": <0-100 integer rating how complete the bid is>,
  "recommended": <boolean — true if this bid is recommended>
}

Return only the JSON, no markdown, no explanation.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = message.content[0].text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Claude did not return valid JSON for bid comparison');
  }
}

module.exports = { extractPlanSpecs, normalizeBid, compareBidToBaseline };
