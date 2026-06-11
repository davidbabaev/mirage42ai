
export default function getTimeAgo(createdAtTime) {

    const rtf = new Intl.RelativeTimeFormat('en', {numeric: 'auto'})
    const date = Date.now()
    const createdAt = new Date(createdAtTime).getTime()
    const timeAgo = date - createdAt;

    // seconds
    if(timeAgo < 60000){
        const seconds = timeAgo / 1000
        return rtf.format(-seconds.toFixed(0), 'second');
    }
    
    // minutes
    if(timeAgo < 3600000){
        const minutes = timeAgo / 60000
        return rtf.format(-minutes.toFixed(0), 'minute');
    }
    
    // hours
    if(timeAgo < 86400000){
        const hours = timeAgo / 3600000
        return rtf.format(-hours.toFixed(0), 'hour');
    }
    
    // days
    const days = timeAgo / 86400000
    return rtf.format(-days.toFixed(0), 'day');    
}
