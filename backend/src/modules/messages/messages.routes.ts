import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/asyncHandler';
import {
  handleCreateWorkspaceChannel,
  handleCreateWorkspaceConversationMessage,
  handleCreateWorkspaceDirectConversation,
  handleCreateWorkspaceGroupConversation,
  handleCreateWorkspaceMessage,
  handleCreateWorkspaceUser,
  handleDeleteWorkspaceChannel,
  handleDeleteWorkspaceDirectConversation,
  handleDeleteWorkspaceGroupConversation,
  handleGetWorkspaceState,
  handleMarkWorkspaceConversationRead,
  handleUpdateWorkspaceChannel,
  handleUpdateWorkspaceGroupConversation,
} from './messages.controller';

const router = Router();

router.use(requireAuth);
router.get('/workspaces/:workspaceId/state', asyncHandler(handleGetWorkspaceState));
router.post('/workspaces/:workspaceId/channels', asyncHandler(handleCreateWorkspaceChannel));
router.patch('/workspaces/:workspaceId/channels/:channelId', asyncHandler(handleUpdateWorkspaceChannel));
router.delete('/workspaces/:workspaceId/channels/:channelId', asyncHandler(handleDeleteWorkspaceChannel));
router.post('/workspaces/:workspaceId/direct-conversations', asyncHandler(handleCreateWorkspaceDirectConversation));
router.delete('/workspaces/:workspaceId/direct-conversations/:directId', asyncHandler(handleDeleteWorkspaceDirectConversation));
router.post('/workspaces/:workspaceId/groups', asyncHandler(handleCreateWorkspaceGroupConversation));
router.patch('/workspaces/:workspaceId/groups/:groupId', asyncHandler(handleUpdateWorkspaceGroupConversation));
router.delete('/workspaces/:workspaceId/groups/:groupId', asyncHandler(handleDeleteWorkspaceGroupConversation));
router.post('/workspaces/:workspaceId/channels/:channelId/messages', asyncHandler(handleCreateWorkspaceMessage));
router.post('/workspaces/:workspaceId/conversations/:conversationType/:conversationId/messages', asyncHandler(handleCreateWorkspaceConversationMessage));
router.post('/workspaces/:workspaceId/conversations/:conversationType/:conversationId/read', asyncHandler(handleMarkWorkspaceConversationRead));
router.post('/workspaces/:workspaceId/users', asyncHandler(handleCreateWorkspaceUser));

export { router as messagesRouter };
