'use strict';

const {metadataAccessToken} = require('./ai');

function createPublisher({fetchImpl = globalThis.fetch, projectId, topic, tokenProvider = () => metadataAccessToken(fetchImpl)} = {}) {
  return async (event) => {
    if (!projectId || !topic) throw new Error('Publicação exige GCP_PROJECT_ID e AI_OUTPUT_TOPIC.');
    const response = await fetchImpl(`https://pubsub.googleapis.com/v1/projects/${projectId}/topics/${topic}:publish`, {
      method: 'POST',
      headers: {'content-type': 'application/json', authorization: `Bearer ${await tokenProvider()}`},
      body: JSON.stringify({messages: [{
        data: Buffer.from(JSON.stringify(event)).toString('base64'),
        attributes: {event: event.eventType, correlationId: event.correlationId || ''},
      }]}),
    });
    if (!response.ok) throw new Error(`Pub/Sub respondeu HTTP ${response.status}.`);
    return response.json();
  };
}

function createPublisherFromEnv(env = process.env) {
  return createPublisher({projectId: env.GCP_PROJECT_ID, topic: env.AI_OUTPUT_TOPIC});
}

module.exports = {createPublisher, createPublisherFromEnv};
