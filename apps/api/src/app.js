require('dotenv').config();
const morgan = require('morgan');
const express = require('express');
const passport = require('passport');


const corsPolicyMiddleware = require('./middlewares/cors');
const app = express();

require('./auth/googleStrategy');
app.use(passport.initialize());

app.use(corsPolicyMiddleware)
app.use(express.json());
// app.use(express.static(__dirname + '/public'));
app.use(morgan("dev"));

const router = require('./router/router');
const {connectToDB} = require('./dbService');
const chalk = require('chalk');

const PORT = process.env.PORT || 8181;

// Create http server + io FIRST (so io exists) 

const http = require('http');
const server = http.createServer(app);

const {Server} = require('socket.io');
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:8181",
            "https://db-social-media-app.onrender.com",
            "https://mirage-frontend-tfxf.onrender.com",
            "https://mirage42.com",
            "https://www.mirage42.com",
        ]
    }
})

// socket setup
const chatSocket = require('./chat/routes/chatSocket');
chatSocket(io)


// All routes (regular + chat) - before catch-all
app.use(router); // connect router to app
const chatRoutes = require('./chat/routes/chatRoutes')
app.use(chatRoutes(io))

// Catch-all (SPA fallback) - after all real routes
// app.get('/{*splat}', (req,res) => {
//     res.sendFile(__dirname + '/public/index.html')
// })

// this line handle errors global on our all files. prevent server collapse
app.use((err, req, res, next ) => {
    if(err.code === "LIMIT_FILE_SIZE"){
        return res.status(400).send("File it too large. Maximum size is 50M")
    }
    console.log('ERROR: ', err.message);
    res.status(500).send('Internal error of the server')
})

// Start the server
server.listen(PORT, () => {
    console.log(chalk.yellow('App is listening to port', PORT));
    connectToDB();
});
