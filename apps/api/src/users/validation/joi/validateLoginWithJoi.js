const Joi = require('joi');

// Login input guard. The critical job is the STRING type-check: Joi.string()
// rejects operator objects like { $gt: "" }, closing the NoSQL-injection /
// auth-bypass hole before the value reaches User.findOne({ email }).
//
// Email mirrors registration's format (so anything that could register can log
// in). Password is intentionally only "non-empty string" — login must accept
// every existing password and must NOT re-impose registration's complexity
// rules; the type-check alone is what closes the hole.
const emailRegex = /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/;

const validateLogin = (credentials) => {
    const schema = Joi.object({
        email: Joi.string().regex(emailRegex).required(),
        password: Joi.string().min(1).max(1024).required(),
    }).unknown(false).required();

    return schema.validate(credentials);
};

module.exports = validateLogin;
