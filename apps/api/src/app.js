require('dotenv').config();

// Fail fast on missing critical config before anything else boots. validateEnv
// throws on a missing required var; turn that into a loud non-zero exit here.
try {
    require('./utils/validateEnv')();
} catch (err) {
    console.error(`FATAL: ${err.message}`);
    process.exit(1);
}

const morgan = require('morgan');
const express = require('express');
const passport = require('passport');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');


const corsPolicyMiddleware = require('./middlewares/cors');
const { isOriginAllowed } = require('./config/allowedOrigins');
const { generalLimiter } = require('./middlewares/rateLimit');
const app = express();

// Correct per-IP rate limiting / client IP behind a proxy (e.g. Render).
app.set('trust proxy', 1);

require('./auth/googleStrategy');

// Security headers first. API is JSON-only and the SPA is a separate origin,
// so CSP adds nothing here and CORP must allow cross-origin (CORS is unchanged).
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // HSTS only in production (real HTTPS behind the proxy). In dev the API is
    // plain HTTP on localhost; sending HSTS makes the browser force-upgrade all
    // http://localhost:* requests to https, which the API can't serve, surfacing
    // as ERR_CONNECTION_RESET in the SPA.
    hsts: process.env.NODE_ENV === 'production',
}));

app.use(passport.initialize());

app.use(corsPolicyMiddleware)
app.use(express.json());
app.use(cookieParser());
// app.use(express.static(__dirname + '/public'));
app.use(morgan("dev"));

// Loose, app-wide rate limit (auth routes add a stricter limiter of their own).
app.use(generalLimiter);

const router = require('./router/router');
const {connectToDB} = require('./dbService');
const chalk = require('chalk');

const PORT = process.env.PORT || 8181;

// Create http server + io FIRST (so io exists) 

const http = require('http');
const server = http.createServer(app);

const {Server} = require('socket.io');
const io = new Server(server, {
    // Same origin policy as the HTTP CORS middleware (see config/allowedOrigins),
    // including per-deploy preview origins. No credentials here: the socket
    // authenticates via a JWT in the handshake auth payload (chatSocket.js), not
    // via the refresh cookie.
    cors: {
        origin: (origin, cb) => cb(null, isOriginAllowed(origin)),
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

// Start the server only when run directly (skipped when imported by tests)
if (require.main === module) {
    // Bind IPv4 all-interfaces, not Node's default dual-stack (::). WSL2 NAT-mode
    // localhost forwarding resets (rather than refuses) IPv6 ::1 connections to a
    // dual-stack bind, so the browser never fails over to IPv4 -> ERR_CONNECTION_RESET.
    // 0.0.0.0 is correct in dev and on the prod host alike.
    server.listen(PORT, '0.0.0.0', () => {
        console.log(chalk.yellow('App is listening to port', PORT));
        connectToDB();
    });
}

module.exports = { app, server };
