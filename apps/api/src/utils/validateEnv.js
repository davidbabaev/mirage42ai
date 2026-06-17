// Fail fast at boot if critical config is missing, instead of crashing later
// in a confusing way. Throws on a missing *required* var (the caller in app.js
// logs it and exits non-zero); merely warns on missing optional ones. Throwing
// rather than calling process.exit here keeps the function unit-testable.

const BASE_REQUIRED = ['DB_CONNECTION_STRING', 'JWT_SECRET'];
const CLOUDINARY = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const OTHER_OPTIONAL = ['PORT', 'CLIENT_URL', 'SERVER_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];

function validateEnv() {
    const isSet = (k) => typeof process.env[k] === 'string' && process.env[k].trim() !== '';
    const isProd = process.env.NODE_ENV === 'production';

    // Cloudinary is required in production (uploads must work for real users),
    // but only warned about in dev/test where uploads are often stubbed.
    const required = isProd ? [...BASE_REQUIRED, ...CLOUDINARY] : BASE_REQUIRED;
    const optional = isProd ? OTHER_OPTIONAL : [...OTHER_OPTIONAL, ...CLOUDINARY];

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
