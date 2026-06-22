import React, { useState } from 'react';
import { Box } from '@mui/material';
import countries from '../data/countries';

// Local, neutral fallback used when a country name has no known ISO code or its
// flag asset fails to load. Never reference an external/CDN placeholder.
const PLACEHOLDER = '/flags/_placeholder.svg';

// Case-insensitive country NAME -> ISO 3166-1 alpha-2 code, built once from the
// bundled countries list. Flag SVGs are vendored under public/flags/<code>.svg
// (lipis/flag-icons, 4x3) and fetched on demand by the browser.
const codeByName = new Map(
    countries.map((c) => [c.name.trim().toLowerCase(), c.code.toLowerCase()])
);

/**
 * Renders a small rectangular country flag from a country NAME string.
 * Falls back to a local placeholder for unknown/legacy names or load errors.
 */
export default function CountryFlag({ country, width = 24, sx }) {
    const code = country ? codeByName.get(country.trim().toLowerCase()) : undefined;
    const intendedSrc = code ? `/flags/${code}.svg` : PLACEHOLDER;

    // Track which src failed so a prop change (list re-order/re-key) retries the
    // new flag instead of being stuck on the placeholder.
    const [failedSrc, setFailedSrc] = useState(null);
    const src = failedSrc === intendedSrc ? PLACEHOLDER : intendedSrc;

    return (
        <Box
            component="img"
            src={src}
            alt={country ? `${country} flag` : 'Unknown country flag'}
            onError={() => setFailedSrc(intendedSrc)}
            sx={{
                width,
                height: width * 0.75,
                borderRadius: 0.5,
                objectFit: 'cover',
                flexShrink: 0,
                ...sx,
            }}
        />
    );
}
