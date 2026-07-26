// Image API diagnostic (F5 follow-up).
//
//   GEMINI_API_KEY='...' node src/images/diagnoseImageApi.js
//
// Written because the first live reference-face run returned 400 on every call
// and the error handler threw away Google's explanation. This script exists so
// that never has to be guessed at again: it asks the API what it will accept,
// and prints the FULL error body when it refuses.
//
// It does two things, cheapest first:
//   1. Lists the models the key can actually see, on each API version, and
//      flags the ones that advertise image output. No generation cost.
//   2. Tries a minimal generation across the version × model matrix and prints
//      the status and the real body for each.
//
// Step 2 costs money — a few tiny images. It is the last resort, and it is
// skipped entirely if step 1 already shows the model is not available.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env'), quiet: true });

const { generateImage, API_HOST, extractApiErrorMessage } = require('./gemini');
const { readImageConfig } = require('../config');

const VERSIONS = ['v1', 'v1beta'];
const CANDIDATE_MODELS = [
    'gemini-3.1-flash-image',
    'gemini-3.1-flash-lite-image',
    'gemini-3-pro-image',
    'gemini-2.5-flash-image',
];

const line = (s = '') => console.log(s);

/** What can this key actually see? The cheapest possible question. */
const listModels = async (apiKey, apiVersion) => {
    const url = `${API_HOST}/${apiVersion}/models`;
    let res;
    try {
        res = await fetch(url, { headers: { 'x-goog-api-key': apiKey } });
    } catch (err) {
        line(`  ${apiVersion}: request failed — ${err.message}`);
        return [];
    }

    const raw = await res.text();
    if (!res.ok) {
        line(`  ${apiVersion}: ${res.status} — ${extractApiErrorMessage(raw)}`);
        return [];
    }

    let body;
    try {
        body = JSON.parse(raw);
    } catch {
        line(`  ${apiVersion}: response was not JSON`);
        return [];
    }

    const models = (body.models || []).map((m) => ({
        name: String(m.name || '').replace(/^models\//, ''),
        methods: m.supportedGenerationMethods || m.supported_generation_methods || [],
    }));

    const imageish = models.filter((m) => /image/i.test(m.name));
    line(`  ${apiVersion}: ${models.length} models visible, ${imageish.length} with "image" in the name`);
    for (const m of imageish) {
        const supportsGenerate = m.methods.length === 0 || m.methods.includes('generateContent');
        line(`      ${supportsGenerate ? '✓' : '✗'} ${m.name}${m.methods.length ? `  [${m.methods.join(', ')}]` : ''}`);
    }
    return imageish.map((m) => m.name);
};

/** Try one real generation and report exactly what came back. */
const probe = async (apiKey, apiVersion, model) => {
    try {
        const image = await generateImage({
            apiKey,
            model,
            apiVersion,
            // Trivial prompt: this is a capability probe, not a photo.
            prompt: 'A plain red circle on a white background.',
            timeoutMs: 45_000,
        });
        line(`  ✓ ${apiVersion}/${model} — OK (${image.mimeType}, ${image.base64.length} b64 chars)`);
        return true;
    } catch (err) {
        line(`  ✗ ${apiVersion}/${model} — ${err.message}`);
        return false;
    }
};

const main = async () => {
    const { apiKey, model: configuredModel } = readImageConfig(process.env);
    if (!apiKey) {
        console.error('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set.');
        console.error("Run it inline:  GEMINI_API_KEY='...' node src/images/diagnoseImageApi.js");
        process.exit(1);
    }

    line('');
    line(`Configured model: ${configuredModel}`);
    line('');
    line('1. Models visible to this key');
    const seen = new Set();
    for (const version of VERSIONS) {
        for (const name of await listModels(apiKey, version)) seen.add(`${version}:${name}`);
    }

    line('');
    line('2. Live generation probe (costs a few small images)');
    if (process.argv.includes('--list-only')) {
        line('  skipped (--list-only)');
    } else {
        let firstWorking = null;
        for (const version of VERSIONS) {
            for (const model of CANDIDATE_MODELS) {
                // Do not pay to confirm what step 1 already ruled out.
                if (seen.size && !seen.has(`${version}:${model}`)) {
                    line(`  – ${version}/${model} — not listed for this key, skipping`);
                    continue;
                }
                const ok = await probe(apiKey, version, model);
                if (ok && !firstWorking) firstWorking = { version, model };
            }
        }

        line('');
        if (firstWorking) {
            line(`WORKING COMBINATION: apiVersion=${firstWorking.version}  model=${firstWorking.model}`);
            line('Set it with:  AGENT_IMAGE_MODEL=' + firstWorking.model);
            line('(the API version default lives in DEFAULT_API_VERSION in src/images/gemini.js)');
        } else {
            line('NOTHING WORKED. The messages above are Google\'s own words — read them:');
            line('  "API key not valid"        → the key is wrong or from the wrong project');
            line('  "not found" / "not supported" → the model is not available to this key/tier');
            line('  "billing"                  → image models usually need billing enabled');
        }
    }
    line('');
};

if (require.main === module) {
    main().catch((err) => {
        console.error('diagnostic failed:', err.message);
        process.exit(1);
    });
}

module.exports = { listModels, probe, CANDIDATE_MODELS, VERSIONS };
