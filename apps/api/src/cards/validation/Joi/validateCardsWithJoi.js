const Joi = require('joi');

const joiSchema = Joi.object({
    title: Joi.string().max(256).allow('').optional(),
    content: Joi.string().min(3).max(1024).required(),
    web: Joi.string().uri().allow('').optional(),
    category: Joi.string().allow('').max(256),
    location: Joi.string().min(3).max(1024),
});

module.exports = joiSchema;