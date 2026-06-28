// CRUD operations - requests:

const express = require('express');
const router = express.Router();
const {handleError, createError} = require('../../utils/handleErrors')

const {
    createNewUser,
    getUsers,
    getUser,
    getBlockedUsers,
    updateUser,
    deleteUser,
    loginUser,
    followUser,
    blockUser,
    // cardsFeed,
    banUser,
    promoteUserToAdmin,
} = require('../service/usersSvc');
const { getRecentContacts } = require('../../chat/service/chatSvc');
const validateUser = require('../validation/joi/validateUserWithJoi');
const validateLogin = require('../validation/joi/validateLoginWithJoi');
const auth = require('../../auth/authService');
const { setRefreshCookie } = require('../../auth/refreshTokens');
const { authLimiter } = require('../../middlewares/rateLimit');
const { uploadImageOnly } = require('../../middlewares/multer');
const uploadToCloudinary = require('../../utils/cloudinary');


router.get('/users', auth, async (req, res) => {
    try{
        const users = await getUsers(req.user.userId, req.user.isAdmin, {
            q: req.query.q,
            limit: req.query.limit,
        });
        res.send(users);
    }
    catch(err){
        handleError(res, err);
    }
})

// Must be registered BEFORE '/users/:id' so 'blocked' isn't captured as an id.
router.get('/users/blocked', auth, async (req, res) => {
    try{
        const blocked = await getBlockedUsers(req.user.userId);
        res.send(blocked);
    }
    catch(err){
        handleError(res, err);
    }
})

// Recent DM contacts for the share-dialog default list. Also before '/users/:id'.
router.get('/users/recent-contacts', auth, async (req, res) => {
    try{
        const contacts = await getRecentContacts(req.user.userId, req.query.limit);
        res.send(contacts);
    }
    catch(err){
        handleError(res, err);
    }
})

router.get('/users/:id', auth, async (req, res) => {
    try{
        const user = await getUser(req.params.id, req.user.userId, req.user.isAdmin);
        res.send(user);
    }
    catch(err){
        handleError(res, err);
    }
})

router.post('/users' , authLimiter, async (req, res) => {
        try{
            const {error} = validateUser(req.body)
            if(error) return res.status(400).send(error.details[0].message);
        
            const {refreshToken, ...newUser} = await createNewUser(req.body);
            setRefreshCookie(res, refreshToken);
            res.send(newUser);
        }
        catch(err){
            handleError(res, err);
            console.log(err.message);
        }
})

router.post('/users/login', authLimiter, async (req,res) => {
    try{
        const {error} = validateLogin(req.body);
        if(error) return res.status(400).send(error.details[0].message);

        const {refreshToken, ...payload} = await loginUser(req.body);
        setRefreshCookie(res, refreshToken);
        res.send(payload);
    }
    catch(err){
        handleError(res, err);
    }
})

router.put('/users/:id', auth, uploadImageOnly.fields([
        {name: 'profilePicture', maxCount: 1},
        {name: 'coverImage', maxCount: 1}
    ]) ,async (req, res) => {
        try{
            const user = await getUser(req.params.id); 

            if(req.user.userId === req.params.id || req.user.isAdmin){

                let defaultProfile = user.profilePicture; 
                let defaultCover = user.coverImage; 
                let profilePictureUrl;
                let coverImageUrl;

                if(req.files['profilePicture']){
                    profilePictureUrl = await uploadToCloudinary(req.files['profilePicture']?.[0].buffer, "users")
                }
                else{
                    profilePictureUrl = defaultProfile
                }

                if(req.files['coverImage']){
                    coverImageUrl = await uploadToCloudinary(req.files['coverImage']?.[0].buffer, "users")
                }
                else{
                    coverImageUrl = defaultCover
                }

                let updatedUser = await updateUser(req.params.id, 
                    {
                        ...req.body,
                        profilePicture: profilePictureUrl,
                        coverImage: coverImageUrl
                    }
                )
                console.log("Updated User: ", updatedUser);

                return res.send(updatedUser);
            }
            else{
                return res.status(403).send('You not allowed to edit this')
            }
        }   
        catch(err){
            handleError(res, err);
    }
})

router.patch('/users/:id/follow', auth, async (req, res) => {
    try{
        let followOnUser = await followUser(req.user.userId, req.params.id);
        res.send(followOnUser);
    }
    catch(err){
        handleError(res, err)
        console.log(err.message);
    }
})

// PATCH /users/:id/block ← toggle block/unblock on another user
router.patch('/users/:id/block', auth, async (req, res) => {
    try{
        let blocked = await blockUser(req.user.userId, req.params.id);
        res.send(blocked);
    }
    catch(err){
        handleError(res, err)
    }
})

router.delete('/users/:id', auth , async (req, res) => {
    try{
        if(req.user.isAdmin && req.user.userId.toString() === req.params.id.toString()) throw createError(403, 'Admin cannot delete himself, always need to be admin to the app')

        if(req.user.userId === req.params.id || req.user.isAdmin){
            const deletedUser = await deleteUser(req.params.id);
            res.send(deletedUser);
        }
        else{
            res.status(403).send('You not allowed to delete users beside yourself')
        }
    }
    catch(err){
       handleError(res, err);
       console.log(err.message);
    }
})

router.patch('/users/:id/ban', auth, async (req,res) => {
    try{
        if(!req.user.isAdmin) throw createError(403, 'Only admin Can ban users!')
        if(req.user.userId.toString() === req.params.id.toString()) throw createError(400, 'cannot ban yourself')

        const banned = await banUser(req.params.id) 
        res.send(banned)
    }
    catch(err){
        handleError(res, err)
    }
})

router.patch('/users/:id/promote', auth, async(req,res) => {
    try{
        if(!req.user.isAdmin) throw createError(403, 'Admin only');
        if(req.user.userId.toString() === req.params.id.toString()) throw createError(400, 'cannot promote yourself');

        const promoted = await promoteUserToAdmin(req.params.id);
        res.send(promoted)
    }
    catch(err){
        handleError(res ,err)
    }
})

module.exports = router;
