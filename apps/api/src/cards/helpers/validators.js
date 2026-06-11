const URL = {
  type: String,
  trim: true,
  match: RegExp(
    /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/
  ),
};

const EMAIL = {
  type: String,
  required: true,
  match: RegExp(/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/),
  unique: true,
  trim: true,
};

const DEFAULT_VALIDATOR = {
  type: String,
  required: true,
  minLength: 2,
  maxLength: 256,
  trim: true,
  lowercase: true,
};

// For phone numbers (String with regex pattern)
const PHONE = {
  type: String,
  required: true,
  match: RegExp(/0[0-9]{1,2}\-?\s?[0-9]{3}\s?[0-9]{4}/),
};

// For actual numbers (like houseNumber, zip, bizNumber)
const NUMBER = {
  type: Number,
  required: true,
  min: 0,
};

module.exports = { URL, EMAIL, DEFAULT_VALIDATOR, PHONE, NUMBER };