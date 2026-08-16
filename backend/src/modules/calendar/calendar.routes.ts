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
  handleListTasks,
  handleCreateTask,
  handleUpdateTask,
  handleDeleteTask,
  handleGetGhostPlacements,
  handleListMasks,
  handleCreateMask,
  handleUpdateMask,
  handleDeleteMask,
  handleGeocode,
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

// Tasks
router.get('/tasks', asyncHandler(handleListTasks));
router.get('/tasks/ghost-placements', asyncHandler(handleGetGhostPlacements));
router.post('/tasks', asyncHandler(handleCreateTask));
router.patch('/tasks/:taskId', asyncHandler(handleUpdateTask));
router.delete('/tasks/:taskId', asyncHandler(handleDeleteTask));

// Masks
router.get('/masks', asyncHandler(handleListMasks));
router.post('/masks', asyncHandler(handleCreateMask));
router.patch('/masks/:maskId', asyncHandler(handleUpdateMask));
router.delete('/masks/:maskId', asyncHandler(handleDeleteMask));

// Geocode proxy
router.get('/geocode', asyncHandler(handleGeocode));

export { router as calendarRouter };
