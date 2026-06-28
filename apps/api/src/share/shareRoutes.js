const express = require('express');
const router = express.Router();
const { buildSharedCardSnapshot } = require('../chat/service/chatSvc');

// Public server-rendered Open Graph route. Social crawlers (WhatsApp, LinkedIn,
// X, Facebook) don't run JS — they read these meta tags from the raw HTML — so
// a shared link must be served as HTML with post-specific OG/Twitter tags. A
// human who opens the link is bounced straight to the SPA card.
//
// NOTE: external preview rendering only works on a public domain (crawlers can't
// reach localhost); verify the HTML locally, treat WhatsApp/LinkedIn rendering
// as a staging acceptance gate.

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SITE_NAME = 'Mirage42';
// Absolute https fallback used when a post has no usable image.
const DEFAULT_OG_IMAGE = 'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?q=80&w=1200&h=630&fit=crop';

// Escape for safe interpolation into HTML attribute values / text (user content).
const esc = (s = '') => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Cloudinary image -> a crisp 1200x630 OG crop; non-Cloudinary https images are
// used as-is; anything else falls back to the banner.
const ogImageForImage = (mediaUrl) => {
    if (!mediaUrl) return DEFAULT_OG_IMAGE;
    if (/res\.cloudinary\.com/.test(mediaUrl) && mediaUrl.includes('/image/upload/')) {
        return mediaUrl.replace('/image/upload/', '/image/upload/c_fill,w_1200,h_630/');
    }
    return /^https:\/\//.test(mediaUrl) ? mediaUrl : DEFAULT_OG_IMAGE;
};

// og:image: video -> the Task C poster frame; image -> 1200x630 crop; else banner.
const ogImageFor = (snap) => {
    if (snap.mediaType === 'video') return snap.posterUrl || DEFAULT_OG_IMAGE;
    if (snap.mediaType === 'image') return ogImageForImage(snap.mediaUrl);
    return DEFAULT_OG_IMAGE;
};

const renderPage = ({ title, description, image, url, redirect }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:type" content="article">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(redirect)}">
<script>location.replace(${JSON.stringify(redirect)})</script>
</head>
<body>Redirecting to <a href="${esc(redirect)}">${SITE_NAME}</a>…</body>
</html>`;

router.get('/s/card/:cardId', async (req, res) => {
    const { cardId } = req.params;
    const deepLink = `${CLIENT_URL}/allcards?card=${encodeURIComponent(cardId)}`;
    try {
        // Authoritative, server-built snapshot (same source the chat card uses) —
        // never trust client-supplied preview data.
        const snap = await buildSharedCardSnapshot(cardId);
        const snippet = (snap.title || snap.snippet || 'shared a post').replace(/\s+/g, ' ').trim();
        const title = `${snap.authorName} · ${snippet}`.slice(0, 110);
        const description = (snap.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 200);
        res.type('html').send(renderPage({
            title,
            description,
            image: ogImageFor(snap),
            url: deepLink,
            redirect: deepLink,
        }));
    } catch (err) {
        // Card gone / not active -> neutral, non-leaky card. (A crawler request has
        // no viewer session, so an author-blocked-viewer check isn't applicable
        // here; block enforcement for logged-in viewers stays on the API/SPA.)
        res.status(err.status === 404 ? 404 : 200).type('html').send(renderPage({
            title: SITE_NAME,
            description: "This post isn't available.",
            image: DEFAULT_OG_IMAGE,
            url: CLIENT_URL,
            redirect: CLIENT_URL,
        }));
    }
});

module.exports = router;
