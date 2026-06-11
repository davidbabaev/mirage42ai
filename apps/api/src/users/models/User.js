const mongoose = require('mongoose');
const { 
    URL, 
    EMAIL, 
    DEFAULT_VALIDATOR, 
    PHONE, 
    PASSWORD,
} = require('../helpers/userValidators'); 

const UserSchema = new mongoose.Schema({
    name: DEFAULT_VALIDATOR,
    lastName: DEFAULT_VALIDATOR,
    email: EMAIL,
    password: PASSWORD,
    phone: PHONE,
    profilePicture: URL,
    coverImage: URL,
    age: {
        type: Number,
        max: 120,
    },
    job: {
        type: String,
        maxLength: 50,
    },
    gender: {
        type: String,
        maxLength: 10,
    },
    birthDate: {
        type: Date,
    },
    aboutMe: {
        type: String,
        maxLength: 1024,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    address: {
        country:{
            type: String,
            maxLength: 1024,
        },
        city: {
            type: String,
            maxLength: 1024,
        },
        street: {
            type: String,
            maxLength: 1024,
        },
        house: {
            type: Number,
        },
        zip: {
            type: Number,
        }
    },
    following: [String],
    isAdmin: {
        type: Boolean,
        default: false
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    lastLoginAt: {
        type: Date,
        default: Date.now
    },
    googleId: {
        type: String,
        default: null
    }
})

const User = mongoose.model('User', UserSchema);
module.exports = User;