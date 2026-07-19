const express = require('express');
const router = express.Router();

const cardsRouter = require('../cards/routes/cardsRoutes');
const usersRouter = require('../users/routes/usersRoutes');
const notificationsRouter = require('../notifications/routes/notificationsRoutes');
const googleRoutes = require('../auth/googleRoutes');
const authRoutes = require('../auth/authRoutes');
const shareRoutes = require('../share/shareRoutes');
const agentsRouter = require('../agents/routes/agentsRoutes');

router.use(cardsRouter);
router.use(usersRouter);
router.use(notificationsRouter);
router.use(googleRoutes);
router.use(authRoutes);
router.use(shareRoutes);
router.use(agentsRouter);

module.exports = router;