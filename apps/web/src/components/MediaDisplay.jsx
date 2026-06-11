
export default function MediaDisplay({mediaUrl, mediaType, style}) {
    if(mediaType === 'video'){
        return <video src={mediaUrl} controls style={style}/>
    }
    return <img src={mediaUrl} style={style}/>
}
