const bcrypt = require('bcryptjs');

const generateUserPassword = async (password) => {
    try{
        const hashedPassword = await bcrypt.hash(password, 10);
        return hashedPassword;
    }   
    catch(err){
        throw new Error(err.message)
    }
}

const comparePassword = async (password, hashedPassword) => {
    try{
        const isMatch = await bcrypt.compare(password, hashedPassword);
        return isMatch;
    }
    catch(err){
        throw new Error(err.message);
    }
}

module.exports = {generateUserPassword, comparePassword}



// ### Where each function gets used:
// ```
// User registers → POST /users
//     → generateUserPassword("MySecret123!")
//     → saves "$2b$10$xK8f3j..." to MongoDB

// User logs in → POST /users/login
//     → comparePasswords("MySecret123!", "$2b$10$xK8f3j...")
//     → returns true ✅ → sign JWT token