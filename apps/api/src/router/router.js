const express = require('express');
const router = express.Router();

const cardsRouter = require('../cards/routes/cardsRoutes');
const usersRouter = require('../users/routes/usersRoutes');
const notificationsRouter = require('../notifications/routes/notificationsRoutes');
const googleRoutes = require('../auth/googleRoutes');

router.use(cardsRouter);
router.use(usersRouter);
router.use(notificationsRouter);
router.use(googleRoutes);

module.exports = router;