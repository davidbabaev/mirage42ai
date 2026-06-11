
export default function getMessageTime(timeStamp) {

    const date = new Date(timeStamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes}`;
}
