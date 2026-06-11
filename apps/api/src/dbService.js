const mongoose = require('mongoose');

const connectToDB = async() => {
    try{
        // await mongoose.connect(process.env.ATLAS_CONNECTION_STRING);
        await mongoose.connect(process.env.DB_CONNECTION_STRING);
        console.log('connected to mongoDB');
    }
    catch(err){
        console.log('full error: ',err);
    }
}

const disconnectDB = async() => {
    try{
        await mongoose.disconnect(process.env.DB_CONNECTION_STRING);
        console.log('Disconnect from mongoDB');
    }
    catch(err){
        console.log(err.message);
    }
}

module.exports = {connectToDB, disconnectDB};