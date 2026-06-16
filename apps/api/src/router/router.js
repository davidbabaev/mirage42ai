const express = require('express');
const router = express.Router();

const cardsRouter = require('../cards/routes/cardsRoutes');
const usersRouter = require('../users/routes/usersRoutes');
const notificationsRouter = require('../notifications/routes/notificationsRoutes');
const googleRoutes = require('../auth/googleRoutes');
const authRoutes = require('../auth/authRoutes');

router.use(cardsRouter);
router.use(usersRouter);
router.use(notificationsRouter);
router.use(googleRoutes);
router.use(authRoutes);

module.exports = router;