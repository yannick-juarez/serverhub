import type { Request, Response } from 'express';
import { broadcastNewMessage } from '../../middleware/websocket';
import {
  createWorkspaceChannel,
  createWorkspaceConversationMessage,
  createWorkspaceDirectConversation,
  createWorkspaceGroupConversation,
  createWorkspaceMessage,
  createWorkspaceUser,
  deleteWorkspaceChannel,
  deleteWorkspaceDirectConversation,
  deleteWorkspaceGroupConversation,
  getWorkspaceMessagingState,
  markWorkspaceConversationRead,
  updateWorkspaceChannel,
  updateWorkspaceGroupConversation,
} from './messages.service';

export async function handleGetWorkspaceState(req: Request, res: Response): Promise<void> {
  const workspaceId = req.params.workspaceId;
  const data = await getWorkspaceMessagingState(workspaceId, req.user?.username ?? '');
  res.json({ success: true, data });
}

export async function handleCreateWorkspaceChannel(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const { name, description } = req.body as { name?: string; description?: string };

    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const data = await createWorkspaceChannel(workspaceId, name, description ?? '');
    res.status(201).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to create channel';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleUpdateWorkspaceChannel(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const channelId = req.params.channelId;
    const { name, description } = req.body as { name?: string; description?: string };

    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const data = await updateWorkspaceChannel(workspaceId, channelId, name, description ?? '');
    res.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to update channel';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleDeleteWorkspaceChannel(req: Request, res: Response): Promise<void> {
  try {
    await deleteWorkspaceChannel(req.params.workspaceId, req.params.channelId);
    res.json({ success: true, data: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to delete channel';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleCreateWorkspaceMessage(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const channelId = req.params.channelId;
    const { content } = req.body as { content?: string };
    const actorUsername = req.user?.username ?? '';

    if (!content) {
      res.status(400).json({ success: false, error: 'content is required' });
      return;
    }

    const data = await createWorkspaceMessage(workspaceId, channelId, content, actorUsername);
    res.status(201).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to create message';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleCreateWorkspaceConversationMessage(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const conversationType = req.params.conversationType as 'channel' | 'direct' | 'group';
    const conversationId = req.params.conversationId;
    const { content } = req.body as { content?: string };
    const actorUsername = req.user?.username ?? '';

    if (!content) {
      res.status(400).json({ success: false, error: 'content is required' });
      return;
    }

    if (!['channel', 'direct', 'group'].includes(conversationType)) {
      res.status(400).json({ success: false, error: 'invalid conversation type' });
      return;
    }

    const data = await createWorkspaceConversationMessage(
      workspaceId,
      conversationType,
      conversationId,
      content,
      actorUsername,
    );

    // Broadcast new message to WebSocket clients
    broadcastNewMessage(workspaceId, data);

    res.status(201).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to create message';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleCreateWorkspaceDirectConversation(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const { participant_user_id: participantUserId } = req.body as { participant_user_id?: string };
    const actorUsername = req.user?.username ?? '';

    if (!participantUserId) {
      res.status(400).json({ success: false, error: 'participant_user_id is required' });
      return;
    }

    const data = await createWorkspaceDirectConversation(workspaceId, participantUserId, actorUsername);
    res.status(201).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to create direct conversation';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleCreateWorkspaceGroupConversation(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const {
      name,
      description,
      member_user_ids: memberUserIds,
    } = req.body as { name?: string; description?: string; member_user_ids?: string[] };
    const actorUsername = req.user?.username ?? '';

    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const data = await createWorkspaceGroupConversation(
      workspaceId,
      name,
      description ?? '',
      Array.isArray(memberUserIds) ? memberUserIds : [],
      actorUsername,
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to create group conversation';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleUpdateWorkspaceGroupConversation(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const groupId = req.params.groupId;
    const { name, description } = req.body as { name?: string; description?: string };
    const actorUsername = req.user?.username ?? '';

    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const data = await updateWorkspaceGroupConversation(workspaceId, groupId, name, description ?? '', actorUsername);
    res.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to update group conversation';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleDeleteWorkspaceGroupConversation(req: Request, res: Response): Promise<void> {
  try {
    await deleteWorkspaceGroupConversation(req.params.workspaceId, req.params.groupId, req.user?.username ?? '');
    res.json({ success: true, data: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to delete group conversation';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleDeleteWorkspaceDirectConversation(req: Request, res: Response): Promise<void> {
  try {
    await deleteWorkspaceDirectConversation(req.params.workspaceId, req.params.directId, req.user?.username ?? '');
    res.json({ success: true, data: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to delete direct conversation';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleMarkWorkspaceConversationRead(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const conversationType = req.params.conversationType as 'channel' | 'direct' | 'group';
    const conversationId = req.params.conversationId;

    if (!['channel', 'direct', 'group'].includes(conversationType)) {
      res.status(400).json({ success: false, error: 'invalid conversation type' });
      return;
    }

    await markWorkspaceConversationRead(workspaceId, conversationType, conversationId, req.user?.username ?? '');
    res.json({ success: true, data: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to mark conversation as read';
    res.status(400).json({ success: false, error: message });
  }
}

export async function handleCreateWorkspaceUser(req: Request, res: Response): Promise<void> {
  try {
    const workspaceId = req.params.workspaceId;
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'username and password are required' });
      return;
    }

    const data = await createWorkspaceUser(workspaceId, username, password);
    res.status(201).json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unable to create workspace user';
    res.status(400).json({ success: false, error: message });
  }
}
