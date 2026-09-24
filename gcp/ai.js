'use strict';

const ALLOWED_RISK_LEVELS = new Set(['low', 'medium', 'high']);
const ALLOWED_DECISIONS = new Set(['approve', 'review', 'reject']);

function validateAIResult(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('A IA deve retornar um objeto JSON.');
  }
  if (!ALLOWED_RISK_LEVELS.has(result.riskLevel)) {
    throw new Error('A IA deve retornar riskLevel low, medium ou high.');
  }
  if (!ALLOWED_DECISIONS.has(result.decision)) {
    throw new Error('A IA deve retornar decision approve, review ou reject.');
  }
  if (typeof result.reason !== 'string' || result.reason.trim() === '') {
    throw new Error('A IA deve retornar uma justificativa.');
  }
  return {
    riskLevel: result.riskLevel,
    decision: result.decision,
    reason: result.reason.trim().slice(0, 240),
    modelVersion: typeof result.modelVersion === 'string' ? result.modelVersion : 'unknown',
  };
}

function mockEnrich(order) {
  const highQuantity = Number(order.quantity) >= 10;
  const riskLevel = highQuantity ? 'medium' : 'low';
  return validateAIResult({
    riskLevel,
    decision: highQuantity ? 'review' : 'approve',
    reason: highQuantity ? 'Quantidade acima do limite automático.' : 'Pedido simples para processamento automático.',
    modelVersion: 'mock-v1',
  });
}

function parseModelText(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(cleaned);
}

async function metadataAccessToken(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
    headers: {'Metadata-Flavor': 'Google'},
  });
  if (!response.ok) throw new Error(`Metadata server respondeu HTTP ${response.status}.`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error('Metadata server não retornou access_token.');
  return payload.access_token;
}

function createVertexAIProvider({fetchImpl = globalThis.fetch, accessToken, tokenProvider = () => metadataAccessToken(fetchImpl), projectId, location = 'us-central1', model = 'gemini-2.0-flash'} = {}) {
  return async (order) => {
    if (typeof fetchImpl !== 'function') throw new Error('fetch indisponível para o provedor Vertex AI.');
    if (!projectId) throw new Error('Vertex AI exige projectId configurado fora do código.');

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
    const token = accessToken || await tokenProvider();
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {'content-type': 'application/json', authorization: `Bearer ${token}`},
      body: JSON.stringify({
        contents: [{role: 'user', parts: [{text: [
          'Classifique o pedido abaixo. Retorne SOMENTE JSON válido com riskLevel, decision e reason.',
          'Não execute ações e não invente campos.',
          JSON.stringify({orderId: order.orderId, product: order.product, quantity: order.quantity}),
        ].join('\n')}]}],
        generationConfig: {temperature: 0, responseMimeType: 'application/json'},
      }),
    });
    if (!response.ok) throw new Error(`Vertex AI respondeu HTTP ${response.status}.`);
    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
    return validateAIResult({...parseModelText(text), modelVersion: model});
  };
}

function createAIProvider(env = process.env) {
  if (env.NODE_ENV === 'test' || env.AI_PROVIDER === 'mock') return mockEnrich;
  if (env.AI_PROVIDER !== 'vertex') {
    throw new Error('AI_PROVIDER=vertex é obrigatório no ambiente implantado.');
  }
  return createVertexAIProvider({
    accessToken: env.VERTEX_AI_ACCESS_TOKEN,
    projectId: env.GCP_PROJECT_ID,
    location: env.GCP_REGION || 'us-central1',
    model: env.VERTEX_AI_MODEL || 'gemini-2.0-flash',
  });
}

module.exports = {createAIProvider, createVertexAIProvider, metadataAccessToken, mockEnrich, validateAIResult};
