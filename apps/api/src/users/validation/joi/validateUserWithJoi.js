const Joi = require('joi');

const imageUrlRegExp = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/;

const validateUser = (user) => {
    const validated = Joi.object({
        name: Joi.string().min(2).max(20).required(),
        lastName: Joi.string().min(2).max(20).required(),
        email: Joi.string().regex(RegExp(/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/)).required(),
        password: Joi.string().regex(RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/)).required(),
        phone: Joi.string().regex(RegExp(/0[0-9]{1,2}\-?\s?[0-9]{3}\s?[0-9]{4}/)).required(),
        age: Joi.number().integer().required(),
        job: Joi.string().max(50),
        gender: Joi.string().max(10),
        birthDate: Joi.date().required(),
        aboutMe: Joi.string().max(1024).allow(''),
        address: Joi.object({
            country: Joi.string(),
            city: Joi.string(),
            street: Joi.string(),
            house: Joi.number().integer().max(10000),
            zip: Joi.number().integer().max(100000),
        }).required()
    }).unknown(false).required();

    return validated.validate(user)
}

module.exports = validateUser;
