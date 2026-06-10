import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import { HiOutlinePencilSquare, HiOutlineUsers, HiOutlineXMark } from "react-icons/hi2";
import {
  createUser,
  deleteUser,
  getMe,
  getPreferences,
  getUsers,
  patchPreferences,
  updateUserRole,
  updateUsername,
  updateUserPassword,
  updateUserStatus,
  type SettingsUser,
} from "../../../api/settings";
import type { SettingsSectionDefinition } from "../types";

type UserDisplayNames = Record<string, string>;
type EditModalType = "none" | "username" | "display" | "password" | "roles";
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function validateUsername(value: string): string | null {
  const normalized = normalizeUsername(value);
  if (!normalized) {
    return "Username is required.";
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return "Username must use 2-32 chars: letters, numbers, dot, underscore or hyphen.";
  }

  return null;
}

function publishDisplayNames(nextMap: UserDisplayNames) {
  localStorage.setItem("userDisplayNames", JSON.stringify(nextMap));
  window.dispatchEvent(new CustomEvent("user-display-names-updated", { detail: nextMap }));
}

function formatDate(value: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const UsersSettingsSection = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [currentUsername, setCurrentUsername] = useState("");
  const [currentIsAdmin, setCurrentIsAdmin] = useState(false);

  const [displayNames, setDisplayNames] = useState<UserDisplayNames>({});

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const [editModalType, setEditModalType] = useState<EditModalType>("none");
  const [editUser, setEditUser] = useState<SettingsUser | null>(null);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username)),
    [users],
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);

    const [usersResult, meResult, prefsResult] = await Promise.allSettled([
      getUsers(),
      getMe(),
      getPreferences(),
    ]);

    if (usersResult.status === "fulfilled") {
      setUsers(usersResult.value);
    } else {
      setError(usersResult.reason instanceof Error ? usersResult.reason.message : "Unable to load users");
    }

    if (meResult.status === "fulfilled") {
      setCurrentUsername(meResult.value.username);
      setCurrentIsAdmin(Boolean(meResult.value.is_admin));
    }

    if (prefsResult.status === "fulfilled") {
      const raw = prefsResult.value.userDisplayNames;
      const parsed = raw && typeof raw === "object" ? (raw as UserDisplayNames) : {};
      setDisplayNames(parsed);
      publishDisplayNames(parsed);
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const submitCreateUser = async () => {
    const normalizedUsername = normalizeUsername(newUsername);
    const usernameError = validateUsername(normalizedUsername);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    const exists = users.some((user) => normalizeUsername(user.username) === normalizedUsername);
    if (exists) {
      setError("Username already exists.");
      return;
    }

    try {
      setCreatingUser(true);
      setError(null);
      const created = await createUser(normalizedUsername, newPassword);
      setUsers((prev) => [...prev, created]);
      setNewUsername("");
      setNewPassword("");
      setShowCreateForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const submitToggleUser = async (user: SettingsUser, nextActive: boolean) => {
    const actionKey = `status:${user.username}`;
    try {
      setPendingAction(actionKey);
      const updated = await updateUserStatus(user.username, nextActive);
      setUsers((prev) => prev.map((item) => (item.user_id === updated.user_id ? updated : item)));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user status");
    } finally {
      setPendingAction(null);
    }
  };

  const submitToggleAdmin = async (user: SettingsUser, nextIsAdmin: boolean) => {
    const actionKey = `admin:${user.username}`;
    try {
      setPendingAction(actionKey);
      const updated = await updateUserRole(user.username, nextIsAdmin);
      setUsers((prev) => prev.map((item) => (item.user_id === updated.user_id ? updated : item)));
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update admin role");
    } finally {
      setPendingAction(null);
    }
  };

  const submitPassword = async (user: SettingsUser) => {
    const nextPassword = passwordDraft;
    if (nextPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const actionKey = `password:${user.username}`;
    try {
      setPendingAction(actionKey);
      await updateUserPassword(user.username, nextPassword);
      setPasswordDraft("");
      setEditModalType("none");
      setEditUser(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update password");
    } finally {
      setPendingAction(null);
    }
  };

  const submitRenameUser = async (user: SettingsUser) => {
    if (user.username === currentUsername) {
      setError("You cannot rename your own account while connected.");
      return;
    }

    const nextUsername = normalizeUsername(usernameDraft);
    const usernameError = validateUsername(nextUsername);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    if (nextUsername === user.username) {
      setError("New username must be different.");
      return;
    }

    const duplicate = users.some(
      (item) => item.user_id !== user.user_id && normalizeUsername(item.username) === nextUsername,
    );
    if (duplicate) {
      setError("Username already exists.");
      return;
    }

    const actionKey = `username:${user.user_id}`;

    try {
      setPendingAction(actionKey);
      setError(null);

      const updated = await updateUsername(user.username, nextUsername);
      setUsers((prev) => prev.map((item) => (item.user_id === updated.user_id ? updated : item)));

      const nextDisplayNames: UserDisplayNames = { ...displayNames };
      const previousDisplayName =
        (displayNames[user.username] ?? user.username).trim() || updated.username;

      delete nextDisplayNames[user.username];
      nextDisplayNames[updated.username] = previousDisplayName;

      await patchPreferences({ userDisplayNames: nextDisplayNames });
      setDisplayNames(nextDisplayNames);
      publishDisplayNames(nextDisplayNames);
      setEditModalType("none");
      setEditUser(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename user");
    } finally {
      setPendingAction(null);
    }
  };

  const submitDeleteUser = async (user: SettingsUser) => {
    const confirmDelete = window.confirm(`Delete user ${user.username}?`);
    if (!confirmDelete) return;

    const actionKey = `delete:${user.username}`;
    const isSelf = user.username === currentUsername;
    try {
      setPendingAction(actionKey);
      await deleteUser(user.username);
      setUsers((prev) => prev.filter((item) => item.user_id !== user.user_id));

      if (isSelf) {
        Cookies.remove("token");
        Cookies.remove("user");
        window.location.href = "/login";
        return;
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete user");
    } finally {
      setPendingAction(null);
    }
  };

  const saveDisplayName = async (user: SettingsUser) => {
    const actionKey = `display:${user.username}`;
    const nextMap: UserDisplayNames = {
      ...displayNames,
      [user.username]: displayNameDraft.trim() || user.username,
    };

    try {
      setPendingAction(actionKey);
      await patchPreferences({ userDisplayNames: nextMap });
      setDisplayNames(nextMap);
      publishDisplayNames(nextMap);
      setEditModalType("none");
      setEditUser(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save display name");
    } finally {
      setPendingAction(null);
    }
  };

  const openEditModal = (type: EditModalType, user: SettingsUser) => {
    setError(null);
    setEditUser(user);
    setEditModalType(type);

    if (type === "username") {
      setUsernameDraft(user.username);
    }

    if (type === "display") {
      setDisplayNameDraft(displayNames[user.username] ?? user.username);
    }

    if (type === "password") {
      setPasswordDraft("");
    }
  };

  const closeEditModal = () => {
    setEditModalType("none");
    setEditUser(null);
    setUsernameDraft("");
    setDisplayNameDraft("");
    setPasswordDraft("");
  };

  if (loading) {
    return <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-slate-300">Loading users...</div>;
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="mt-1 text-xs text-slate-400">
            Create users, rename accounts, set display names, update passwords and activate/deactivate accounts.
          </p>
        </div>
        <button
          className="shrink-0 self-start rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:bg-white/15"
          onClick={() => setShowCreateForm((prev) => !prev)}
        >
          {showCreateForm ? "Cancel" : "+ Add user"}
        </button>
      </div>

      {error ? <div className="mt-3 rounded-lg border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

      {showCreateForm ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
            <input
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="username"
            />
            <input
              type="password"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="password (min 6 chars)"
            />
            <button
              type="button"
              className="rounded-lg bg-white/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-white disabled:opacity-60"
              disabled={creatingUser || !newUsername.trim() || newPassword.length < 6}
              onClick={() => {
                void submitCreateUser();
              }}
            >
              {creatingUser ? "Creating..." : "Create user"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Display name</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedUsers.map((user) => {
              const isSelf = user.username === currentUsername;
              const statusKey = `status:${user.username}`;
              const deleteKey = `delete:${user.username}`;

              return (
                <tr key={user.user_id} className="bg-black/10 text-slate-200">
                  <td className="px-3 py-2 text-sm font-medium">
                    {user.username}
                    {isSelf ? <span className="mt-1 inline-block text-xs text-slate-300">(you)</span> : null}
                  </td>
                  <td className="px-3 py-2 text-sm">{displayNames[user.username] ?? user.username}</td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={user.is_active}
                        disabled={pendingAction === statusKey || isSelf}
                        onChange={(event) => {
                          void submitToggleUser(user, event.target.checked);
                        }}
                      />
                      {user.is_active ? "active" : "disabled"}
                    </label>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-300">{formatDate(user.updated_at)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs transition hover:bg-white/15 disabled:opacity-60"
                        disabled={isSelf}
                        onClick={() => openEditModal("username", user)}
                      >
                        <HiOutlinePencilSquare className="h-3.5 w-3.5" />
                        Username
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs transition hover:bg-white/15"
                        onClick={() => openEditModal("display", user)}
                      >
                        <HiOutlinePencilSquare className="h-3.5 w-3.5" />
                        Display
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs transition hover:bg-white/15"
                        onClick={() => openEditModal("password", user)}
                      >
                        <HiOutlinePencilSquare className="h-3.5 w-3.5" />
                        Password
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs transition hover:bg-white/15"
                        onClick={() => openEditModal("roles", user)}
                      >
                        <HiOutlinePencilSquare className="h-3.5 w-3.5" />
                        Roles
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-300/30 bg-red-500/10 px-2 py-1 text-xs text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
                        disabled={pendingAction === deleteKey}
                        onClick={() => {
                          void submitDeleteUser(user);
                        }}
                      >
                        {pendingAction === deleteKey ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editModalType !== "none" && editUser ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-950 p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {editModalType === "username" ? "Edit username" : null}
                {editModalType === "display" ? "Edit display name" : null}
                {editModalType === "password" ? "Update password" : null}
                {editModalType === "roles" ? "Manage roles" : null}
              </h3>
              <button
                type="button"
                className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                onClick={closeEditModal}
              >
                <HiOutlineXMark className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-xs text-slate-400">User: {editUser.username}</p>

            {editModalType === "username" ? (
              <input
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                value={usernameDraft}
                onChange={(event) => setUsernameDraft(event.target.value)}
                placeholder="username"
                disabled={pendingAction === `username:${editUser.user_id}`}
                autoFocus
              />
            ) : null}

            {editModalType === "display" ? (
              <input
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                value={displayNameDraft}
                onChange={(event) => setDisplayNameDraft(event.target.value)}
                placeholder="Display name"
                disabled={pendingAction === `display:${editUser.username}`}
                autoFocus
              />
            ) : null}

            {editModalType === "password" ? (
              <input
                type="password"
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none"
                value={passwordDraft}
                onChange={(event) => setPasswordDraft(event.target.value)}
                placeholder="password (min 6 chars)"
                disabled={pendingAction === `password:${editUser.username}`}
                autoFocus
              />
            ) : null}

            {editModalType === "roles" ? (
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={editUser.is_admin}
                    disabled={pendingAction === `admin:${editUser.username}` || !currentIsAdmin || editUser.username === currentUsername}
                    onChange={(event) => {
                      void submitToggleAdmin(editUser, event.target.checked);
                    }}
                  />
                  <span>Admin</span>
                </label>
                <p className="mt-2 text-xs text-slate-400">
                  {editUser.is_admin ? "This user currently has admin privileges." : "This user currently has standard privileges."}
                </p>
                {editUser.username === currentUsername ? (
                  <p className="mt-2 text-xs text-amber-300">You cannot change your own admin role while connected.</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/15"
                onClick={closeEditModal}
              >
                Cancel
              </button>

              {editModalType === "username" ? (
                <button
                  type="button"
                  className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white disabled:opacity-60"
                  disabled={pendingAction === `username:${editUser.user_id}` || !usernameDraft.trim()}
                  onClick={() => {
                    void submitRenameUser(editUser);
                  }}
                >
                  {pendingAction === `username:${editUser.user_id}` ? "Saving..." : "Save"}
                </button>
              ) : null}

              {editModalType === "display" ? (
                <button
                  type="button"
                  className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white disabled:opacity-60"
                  disabled={pendingAction === `display:${editUser.username}`}
                  onClick={() => {
                    void saveDisplayName(editUser);
                  }}
                >
                  {pendingAction === `display:${editUser.username}` ? "Saving..." : "Save"}
                </button>
              ) : null}

              {editModalType === "password" ? (
                <button
                  type="button"
                  className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white disabled:opacity-60"
                  disabled={pendingAction === `password:${editUser.username}` || passwordDraft.length < 6}
                  onClick={() => {
                    void submitPassword(editUser);
                  }}
                >
                  {pendingAction === `password:${editUser.username}` ? "Saving..." : "Update"}
                </button>
              ) : null}

              {editModalType === "roles" ? (
                <button
                  type="button"
                  className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-white"
                  onClick={closeEditModal}
                >
                  Done
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export const settingsSection: SettingsSectionDefinition = {
  key: "users",
  label: "Users",
  description: "Accounts, display names, passwords",
  component: UsersSettingsSection,
  icon: HiOutlineUsers,
  color: {
    border: "border-violet-500/70",
    background: "bg-violet-500/40",
    hover: { border: "hover:border-violet-400/30", background: "hover:bg-violet-400/30" },
    idle: { border: "border-violet-500/20", background: "bg-violet-500/10" },
  },
  order: 10,
};
