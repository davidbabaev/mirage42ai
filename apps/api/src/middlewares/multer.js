const multer = require('multer');
const storage = multer.memoryStorage();



const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 //50mb max
    },
    fileFilter: (req, file, cb) => {
        if(file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")){
            // no error, accept the file:
            cb(null, true)
        }
        else{
            cb(new Error("Only image and video files are allowed"))
        }
    }
}) 

const uploadImageOnly = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 //50mb max
    },
    fileFilter: (req, file, cd) => {
        if(file.mimetype.startsWith("image/")){
            cd(null, true)
        }
        else{
            cd(new Error('Only image file is allowed'))
        }
    }
})


module.exports = {upload, uploadImageOnly}; // export so routes can use it