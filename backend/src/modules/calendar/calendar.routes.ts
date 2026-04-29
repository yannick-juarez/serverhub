import { Router } from 'express';
import {
  handleCreateCalendar,
  handleDeleteCalendar,
  handleListCalendars,
  handleUpdateCalendar,
  handleCreateEvent,
  handleDeleteEvent,
  handleListEvents,
  handleUpdateEvent,
} from './calendar.controller';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

// Calendars
router.get('/calendars', asyncHandler(handleListCalendars));
router.post('/calendars', asyncHandler(handleCreateCalendar));
router.patch('/calendars/:calendarId', asyncHandler(handleUpdateCalendar));
router.delete('/calendars/:calendarId', asyncHandler(handleDeleteCalendar));

// Events
router.get('/events', asyncHandler(handleListEvents));
router.post('/events', asyncHandler(handleCreateEvent));
router.patch('/events/:eventId', asyncHandler(handleUpdateEvent));
router.delete('/events/:eventId', asyncHandler(handleDeleteEvent));

export { router as calendarRouter };
