const User = require('../models/User');
const _ = require('lodash');
const {generateUserPassword, comparePassword} = require('../helpers/bcrypt');
const {signNewToken} = require('../../auth/providers/jwt');
const {issueRefreshToken} = require('../../auth/refreshTokens');
const { createError } = require('../../utils/handleErrors');
const normalizeUser = require('../helpers/normalizeUser');
const Card = require('../../cards/models/Card');
const { pickSafeCardFields } = require('../../cards/service/cardsSvc');
const Notification = require('../../notifications/models/Notifications');
 
const pickSafeUserFields = (user) => {
    return _.pick(user.toObject() , [
        "name", 
        "lastName", 
        "email", 
        "phone", 
        "profilePicture", 
        "coverImage",
        "address",
        "age",
        "job",
        "gender",
        "birthDate",
        "aboutMe",
        "createdAt",
        "_id",
        "following",
        "isAdmin",
        "isBanned",
        "lastLoginAt"
    ]);
}

// Public projection: what any logged-in user may see about OTHER users.
// Excludes PII/operational fields (email, phone, birthDate, isAdmin, isBanned,
// lastLoginAt) and trims the address to country + city only.
const pickPublicUserFields = (user) => {
    const obj = user.toObject();
    const fields = _.pick(obj, [
        "name",
        "lastName",
        "profilePicture",
        "coverImage",
        "age",
        "job",
        "gender",
        "aboutMe",
        "createdAt",
        "_id",
        "following",
    ]);
    fields.address = _.pick(obj.address || {}, ["country", "city"]);
    return fields;
}

// Full fields for admins and for a user's own record; public fields otherwise.
const projectUser = (user, requesterId, isAdmin) => {
    const isSelf = requesterId && String(user._id) === String(requesterId);
    return (isAdmin || isSelf) ? pickSafeUserFields(user) : pickPublicUserFields(user);
}

// MongoDB operation

const createNewUser = async (user) => {
    try{
        user.password = await generateUserPassword(user.password)
        const normalizedUser = normalizeUser(user)
        let newUser = new User(normalizedUser);
        newUser = await newUser.save();

        const token = signNewToken(newUser);
        const refreshToken = await issueRefreshToken(newUser);
        const safeUser = pickSafeUserFields(newUser);
        return{token, refreshToken, safeUser}
    }
    catch(err){
        throw err;        
    }
}

const loginUser = async ({email, password}) => {
    try{
        // find the user by email in mongoDB
        let user = await User.findOne({email});
        if(!user) throw createError(401, "Invalid email or password");
        if(user.isBanned) throw createError(400, "You Banned :(");

        // compare plain password with hashed password form DB
        const isMatch = await comparePassword(password, user.password);
        if(!isMatch) throw createError(401, "Invalid email or password");

        user.lastLoginAt = Date.now()

        // password correct --> generate JWT access token + a rotating refresh token.
        // issueRefreshToken persists the user (saving lastLoginAt too).
        const token = signNewToken(user);
        const refreshToken = await issueRefreshToken(user);
        const safeUser = pickSafeUserFields(user);
        return{token, refreshToken, safeUser}
    }
    catch(err){
        throw err;
    }
}

const getUsers = async (requesterId, isAdmin) => {
        const users = await User.find();
        return users.map(user => projectUser(user, requesterId, isAdmin))
}

const getUser = async (userId, requesterId, isAdmin) => {
        const user = await User.findById(userId);
        if(!user) throw createError(401, "User not found")
        return projectUser(user, requesterId, isAdmin)
}

const updateUser = async (userId, content) => {
    const normalizeContent = normalizeUser(content);
    const updatedUser = await User.findByIdAndUpdate(userId, normalizeContent, {new: true});
    if(!updatedUser) throw createError(404, "Update not not possible")
    return pickSafeUserFields(updatedUser)
}

const followUser = async (userId, followingUserId) => {
    // cannot follow yourself
    if(userId === followingUserId) throw createError(400, "Cannot Follow Yourself")

    const user = await User.findById(userId);
    if(!user) throw createError(404, 'User didnt found')

    // if user.following have and id if not put this id in this array
    if(user.following.includes(followingUserId)){
        user.following = user.following.filter(id => id !== followingUserId);
    }
    else{
        user.following.push(followingUserId)
        let notification = new Notification({actionType: 'follow', fromUser: userId, toUser: followingUserId})
        notification = await notification.save()
    }

    const saveFollow = await user.save()
    return pickSafeUserFields(saveFollow);
}   

const deleteUser = async (deletedUserId) => {
    const deleted = await User.findByIdAndDelete(deletedUserId);
    if(!deleted) throw createError(404, "Delete user not possible")

    await Card.deleteMany(
        {userId: deletedUserId},
    )

    await Card.updateMany(
        {likes: deletedUserId},
        {$pull: {likes: deletedUserId}}
    )

    await Card.updateMany(
        {'comments.userId': deletedUserId},
        {$pull: {comments: {userId: deletedUserId}}}
    )

    await User.updateMany(
        {following: deletedUserId},
        {$pull: {following: deletedUserId}}
    )

    return pickSafeUserFields(deleted)
} 

const banUser = async(bannedUserId) => {

    let bannedUser = await User.findById(bannedUserId)
    if(!bannedUser) throw createError(404, "user not found");

    bannedUser.isBanned = !bannedUser.isBanned

    const updatedBannedUser = await bannedUser.save();
    return pickSafeUserFields(updatedBannedUser)
}

const promoteUserToAdmin = async (promotedUserId) => {
    let promotedUser = await User.findById(promotedUserId)
    if(!promotedUser) throw createError(404, "user not found")

    promotedUser.isAdmin = !promotedUser.isAdmin;

    const updatedPromotedUser = await promotedUser.save()
    return pickSafeUserFields(updatedPromotedUser)
}

module.exports = {
    createNewUser, 
    getUsers, 
    getUser, 
    updateUser, 
    deleteUser, 
    loginUser, 
    pickSafeUserFields, 
    followUser, 
    // cardsFeed, 
    banUser, 
    promoteUserToAdmin
};