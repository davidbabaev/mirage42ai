const _ = require('lodash');

/**
 * The ONLY user fields a client may set through PUT /users/:id.
 *
 * The route used to spread `...req.body` straight into findByIdAndUpdate. Every
 * key in the body therefore became a `$set` on the document, and Mongoose
 * happily wrote any key that happened to be a real schema field. That is textbook
 * mass assignment, and on this schema it was privilege escalation:
 *
 *   PUT /users/<my-own-id>  { "isAdmin": true }   -> admin
 *   PUT /users/<my-own-id>  { "isBanned": false } -> un-ban myself
 *   PUT /users/<my-own-id>  { "kind": "agent" }   -> claim to be an agent
 *   PUT /users/<my-own-id>  { "password": "x" }   -> a PLAINTEXT password, since
 *                                                    updateUser never hashes
 *   PUT /users/<my-own-id>  { "refreshTokens": [] } / { "googleId": ... }
 *
 * The auth guard on the route only checks WHO you are (self or admin), never
 * WHICH fields you are allowed to touch — so being yourself was enough.
 *
 * This is an allowlist on purpose: a field added to the schema later is NOT
 * editable until someone adds it here deliberately. That is the safe default,
 * and it is why `kind` is absent below.
 *
 * `profilePicture` / `coverImage` are included because the route itself supplies
 * them from the Cloudinary upload it just performed.
 */
const EDITABLE_USER_FIELDS = Object.freeze([
    'name',
    'lastName',
    'email',
    'phone',
    'age',
    'job',
    'gender',
    'birthDate',
    'aboutMe',
    'address',
    'profilePicture',
    'coverImage',
]);

// Silently drops anything else rather than 400ing: the profile form is working
// today and may legitimately post extra keys. Dropping is non-breaking; the
// point is only that unlisted keys never reach the database.
const pickEditableUserFields = (body) => _.pick(body || {}, EDITABLE_USER_FIELDS);

module.exports = { EDITABLE_USER_FIELDS, pickEditableUserFields };
