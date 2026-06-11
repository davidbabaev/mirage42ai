// v2 because cloudinary has two versions of their API, vs2 is the updated.
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

const uploadToCloudinary = (fileBuffer, folder) => {
    return new Promise((resolve, reject) => {
        // create the stream, pass options + callback
        cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'auto',
            }, // store in this folder
            (error, result)=> { // Cloudinary calls this when done
                if(error) reject(error) // went wrong -> reject
                    else resolve(result.secure_url) // success -> give back URL
            }
        ).end(fileBuffer) // push the buffer into the stream
    })
}

module.exports = uploadToCloudinary;