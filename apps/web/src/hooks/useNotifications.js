import { useEffect, useMemo, useState } from "react";
import { deleteOneNotification, getNotifications, markNotificationsAsRead } from "../services/apiService";
import { useAuth } from "../providers/AuthProvider";

function useNotifications() {

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const {isLoggedIn} = useAuth();
    
    const unreadCount = useMemo(() => {
        return notifications.filter(notification => notification.isRead === false).length
    }, [notifications])

    const handleDeleteNotification = async (notificationId) => {
        try{
            await deleteOneNotification(notificationId);
            setNotifications(notifications.filter(n => n._id !== notificationId))
        }
        catch(err){
            console.log(err.message);
        }
    }

    const getUserNotifications = async () => {
        setLoading(true);
        try{
            const response = await getNotifications();
            setNotifications(response);
        }
        catch(err){
            console.log(err.message);   
        }
        finally{
            setLoading(false);
        }
    }

    useEffect(() => {
        const token = localStorage.getItem('auth-token');
        if(!token) return;

        getUserNotifications();
    }, [isLoggedIn])

    const handleMarkAsRead = async () => {
        try{
            await markNotificationsAsRead();
            setNotifications(prev => prev.map((notification) => {
                return {
                    ...notification,
                    isRead: true
                }
            }))
        }
        catch(err){
            console.log(err.message);
        }
    }

  return {getUserNotifications ,unreadCount ,notifications ,loading, handleDeleteNotification, handleMarkAsRead}
}

export default useNotifications;
