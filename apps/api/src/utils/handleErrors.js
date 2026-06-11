// for mongoDB service files
const createError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return error;
}

// for routes files
const handleError = (res, error) => {
    // if error has a status use it, otherwise 500
    const status = error.status || 500;
    const message = error.message || "Internal server error";
    res.status(status).send(message);
}

module.exports = {handleError, createError};