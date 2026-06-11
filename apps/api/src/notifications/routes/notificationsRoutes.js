const express = require('express');
const router = express.Router();
const {handleError} = require('../../utils/handleErrors');
const auth = require('../../auth/authService');
const { 
    getNotifications, 
    markAsRead, 
    deleteNotification, 
    getNotification 
} = require('../service/notificationsSvc');

// get all notifications for logged-in user
router.get('/notifications', auth, async (req,res) => {
    try{
        let notifications = await getNotifications(req.user.userId);
        res.send(notifications);
    }
    catch(err){
        handleError(res, err)
    }
})

// mark all notifications as read
router.patch('/notifications', auth, async (req,res) => {
    try{
        let notifications = await markAsRead(req.user.userId);
        res.send(notifications)
    }
    catch(err){
        handleError(res, err)
    }
})

// delete one notification
router.delete('/notifications/:id', auth, async (req,res) => {
    try{
        const notification = await getNotification(req.params.id);
        if(req.user.userId === notification.toUser.toString() || req.user.isAdmin){
            const deleteTheNotification = await deleteNotification(req.params.id)
            res.send(deleteTheNotification);
        }
    }
    catch(err){
        handleError(res, err)
    }
})

module.exports = router;