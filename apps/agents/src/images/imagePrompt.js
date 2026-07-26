/**
 * Prompt construction for the consistent-face image pipeline (§7).
 *
 * Two prompts live here and they are deliberately different jobs:
 *
 *   buildReferencePrompt — run ONCE per persona. Produces the reference
 *     portrait that every later image is conditioned on. Clean, neutral,
 *     well-lit: this one is a source of truth about the face, not a photo
 *     anyone is meant to believe was posted.
 *
 *   buildScenePrompt — run per image post. Takes the appearance text plus a
 *     scene and asks for the SAME person somewhere new, in the "amateur phone
 *     photo" register §7 says beats glossy renders for believability.
 *
 * The safety block is appended to both. §6 puts content rules "in every persona
 * prompt"; an image model is another prompt surface, and it is the one where a
 * bad output is hardest to walk back.
 */

/**
 * §6 content rules, expressed for an image model. Phrased as what the picture
 * IS rather than a list of banned things — "fully clothed, casual everyday
 * clothing" steers far better than "no explicit content", which mostly teaches
 * the model the word it should avoid.
 */
const IMAGE_SAFETY_RULES = [
    'The person is an adult, clearly over 25, and looks it.',
    'Fully clothed in ordinary everyday clothing, as for a normal public place.',
    'No nudity, no underwear, no swimwear, no lingerie, no sexualised posing, framing, or emphasis.',
    'No other identifiable real people, no children, and no real public figures.',
    'No text overlays, watermarks, logos, or brand marks.',
    'Nothing violent, medical, distressing, or illegal in frame.',
];

/** The look §7 asks for: believable, not beautiful. */
const AMATEUR_PHONE_LOOK = [
    'Shot casually on a phone by an ordinary person, not by a photographer.',
    'Imperfect framing — slightly off-centre or tilted, the subject not perfectly placed.',
    'Normal available light, not studio lighting and not golden-hour perfection.',
    'Natural skin with real texture, pores, and small blemishes. Not retouched, not smoothed.',
    'Slightly soft focus or minor motion blur is fine and welcome.',
    'No bokeh-heavy portrait mode, no HDR punch, no colour grading, no artistic composition.',
];

const bullets = (items) => items.map((i) => `- ${i}`).join('\n');

const section = (title, items) => `${title}\n${bullets(items)}`;

/**
 * The one-time reference portrait prompt.
 *
 * `angle` describes one shot in the set (§7 wants 3–5 of the same face). The
 * appearance text is repeated verbatim in every later generation, so whatever
 * is written here is the face forever — hence the instruction to render it
 * plainly rather than interpret it.
 */
const buildReferencePrompt = ({ appearance, angle = 'straight-on, neutral expression' } = {}) => {
    if (!appearance || !String(appearance).trim()) {
        throw new Error('buildReferencePrompt requires an appearance description');
    }

    return [
        'A photorealistic reference portrait of a single fictional person who does not exist.',
        '',
        section('Appearance — render exactly as written, do not embellish or reinterpret:', [String(appearance).trim()]),
        '',
        section('Shot:', [
            angle,
            'Head and shoulders, face fully visible and unobstructed.',
            'Plain, uncluttered background.',
            'Even, neutral lighting so the face reads clearly.',
            'Neutral everyday clothing.',
        ]),
        '',
        section('Rules:', IMAGE_SAFETY_RULES),
        '',
        'This is a reference image used to keep one fictional character consistent across later pictures. Accuracy of the face matters more than the photo being flattering.',
    ].join('\n');
};

/**
 * The per-post scene prompt.
 *
 * Order matters: identity first, scene second. Leading with the scene makes the
 * model treat the face as set dressing and drift; leading with the person keeps
 * the face the subject of the instruction.
 */
const buildScenePrompt = ({ appearance, scene, includeFace = true } = {}) => {
    if (!scene || !String(scene).trim()) {
        throw new Error('buildScenePrompt requires a scene');
    }

    // §7: "not every post needs the agent's face (food, views, screenshots —
    // also cheaper)". A faceless post skips the identity block entirely, which
    // also means it cannot drift the face.
    if (!includeFace) {
        return [
            'A casual phone photo with no people in it at all.',
            '',
            section('Scene:', [String(scene).trim()]),
            '',
            section('Look:', AMATEUR_PHONE_LOOK),
            '',
            section('Rules:', [
                'No people, no faces, no hands, and no body parts anywhere in frame.',
                ...IMAGE_SAFETY_RULES.slice(3),
            ]),
        ].join('\n');
    }

    if (!appearance || !String(appearance).trim()) {
        throw new Error('buildScenePrompt requires an appearance description when includeFace is true');
    }

    return [
        'A casual phone photo of the SAME person shown in the reference image, in a new setting.',
        '',
        section('This person — match the reference image exactly:', [
            String(appearance).trim(),
            'Same face, same bone structure, same hair, same skin tone, same apparent age as the reference.',
            'Treat the reference image as the ground truth for the face.',
        ]),
        '',
        section('Scene:', [String(scene).trim()]),
        '',
        section('Look:', AMATEUR_PHONE_LOOK),
        '',
        section('Rules:', IMAGE_SAFETY_RULES),
    ].join('\n');
};

module.exports = {
    buildReferencePrompt,
    buildScenePrompt,
    IMAGE_SAFETY_RULES,
    AMATEUR_PHONE_LOOK,
};
