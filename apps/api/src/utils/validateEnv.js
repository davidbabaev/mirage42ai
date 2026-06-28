// Fail fast at boot if critical config is missing, instead of crashing later
// in a confusing way. Throws on a missing *required* var (the caller in app.js
// logs it and exits non-zero); merely warns on missing optional ones. Throwing
// rather than calling process.exit here keeps the function unit-testable.

const BASE_REQUIRED = ['DB_CONNECTION_STRING', 'JWT_SECRET'];
const CLOUDINARY = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
// Required only in production. In dev the CORS allowlist auto-includes the local
// Vite origin, so ALLOWED_ORIGINS is optional there. In prod the canonical
// front-end origin is baked into the allowlist (see config/allowedOrigins.js
// PROD_ORIGIN), so a missing ALLOWED_ORIGINS can't fully lock the app out — but
// we still require it in prod to force explicit configuration of any ADDITIONAL
// origins (preview deploys, custom domains).
// CLIENT_URL is prod-required too: OAuth redirects (googleRoutes) and share
// deep-links (shareRoutes) build user-facing URLs from it, and the localhost
// fallback would silently point real users at a dev origin.
const PROD_REQUIRED = [...CLOUDINARY, 'ALLOWED_ORIGINS', 'CLIENT_URL'];
const OTHER_OPTIONAL = ['PORT', 'SERVER_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];

function validateEnv() {
    const isSet = (k) => typeof process.env[k] === 'string' && process.env[k].trim() !== '';
    const isProd = process.env.NODE_ENV === 'production';

    // Cloudinary + ALLOWED_ORIGINS are required in production (uploads and CORS
    // must work for real users), but only warned about in dev/test where uploads
    // are stubbed and the dev origin is added automatically.
    const required = isProd ? [...BASE_REQUIRED, ...PROD_REQUIRED] : BASE_REQUIRED;
    const optional = isProd ? OTHER_OPTIONAL : [...OTHER_OPTIONAL, ...PROD_REQUIRED];

    const missingRequired = required.filter((k) => !isSet(k));
    if (missingRequired.length) {
        throw new Error(
            `Missing required environment variable(s): ${missingRequired.join(', ')}. ` +
            `Set them in apps/api/.env (see .env.example) and restart.`
        );
    }

    const missingOptional = optional.filter((k) => !isSet(k));
    if (missingOptional.length) {
        console.warn(
            `WARN: optional environment variable(s) not set: ${missingOptional.join(', ')}. ` +
            `Related features (Google OAuth / Cloudinary uploads) may be disabled.`
        );
    }
}

module.exports = validateEnv;
