// Fail fast at boot if critical config is missing, instead of crashing later
// in a confusing way. Only truly-required vars cause an exit; the rest warn.

const REQUIRED = ['DB_CONNECTION_STRING', 'JWT_SECRET'];
const OPTIONAL = [
    'PORT',
    'CLIENT_URL',
    'SERVER_URL',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
];

function validateEnv() {
    const isSet = (k) => typeof process.env[k] === 'string' && process.env[k].trim() !== '';

    const missingRequired = REQUIRED.filter((k) => !isSet(k));
    if (missingRequired.length) {
        console.error(
            `FATAL: missing required environment variable(s): ${missingRequired.join(', ')}.\n` +
            `Set them in apps/api/.env (see .env.example) and restart.`
        );
        process.exit(1);
    }

    const missingOptional = OPTIONAL.filter((k) => !isSet(k));
    if (missingOptional.length) {
        console.warn(
            `WARN: optional environment variable(s) not set: ${missingOptional.join(', ')}. ` +
            `Related features (Google OAuth / Cloudinary uploads) may be disabled.`
        );
    }
}

module.exports = validateEnv;
