import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { monitoringRouter } from '../modules/monitoring/monitoring.routes';
import { databaseRouter } from '../modules/database/database.routes';
import { filesRouter } from '../modules/files/files.routes';
import { servicesRouter } from '../modules/services/services.routes';
import { logsRouter } from '../modules/logs/logs.routes';
import { cronRouter } from '../modules/cron/cron.routes';
import { connectionsRouter } from '../modules/connections/connections.routes';
import { requestsRouter } from '../modules/requests/requests.routes';
import { preferencesRouter } from '../modules/preferences/preferences.routes';
import { usersRouter } from '../modules/users/users.routes';
import { messagesRouter } from '../modules/messages/messages.routes';
import { calendarRouter } from '../modules/calendar/calendar.routes';
import { updatesRouter } from '../modules/updates/updates.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/monitoring', monitoringRouter);
router.use('/db', databaseRouter);
router.use('/files', filesRouter);
router.use('/services', servicesRouter);
router.use('/logs', logsRouter);
router.use('/cron', cronRouter);
router.use('/connections', connectionsRouter);
router.use('/requests', requestsRouter);
router.use('/preferences', preferencesRouter);
router.use('/users', usersRouter);
router.use('/messages', messagesRouter);
router.use('/calendar', calendarRouter);
router.use('/updates', updatesRouter);

export { router };
