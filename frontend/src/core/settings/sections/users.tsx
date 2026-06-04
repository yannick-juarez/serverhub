import { useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import { HiOutlineUsers } from "react-icons/hi2";
import {
  createUser,
  deleteUser,
  getMe,
  getPreferences,
  getUsers,
  patchPreferences,
  updateUsername,
  updateUserPassword,
  updateUserStatus,
  type SettingsUser,
} from "../../../api/settings";
import type { SettingsSectionDefinition } from "../types";

type UserDisplayNames = Record<string, string>;
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

  const [displayNames, setDisplayNames] = useState<UserDisplayNames>({});
  const [displayNameDrafts, setDisplayNameDrafts] = useState<UserDisplayNames>({});
  const [usernameDrafts, setUsernameDrafts] = useState<Record<string, string>>({});

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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
      setUsernameDrafts(
        Object.fromEntries(usersResult.value.map((item) => [item.user_id, item.username])),
      );
    } else {
      setError(usersResult.reason instanceof Error ? usersResult.reason.message : "Unable to load users");
    }

    if (meResult.status === "fulfilled") {
      setCurrentUsername(meResult.value.username);
    }

    if (prefsResult.status === "fulfilled") {
      const raw = prefsResult.value.userDisplayNames;
      const parsed = raw && typeof raw === "object" ? (raw as UserDisplayNames) : {};
      setDisplayNames(parsed);
      setDisplayNameDrafts(parsed);
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
      setDisplayNameDrafts((prev) => ({ ...prev, [created.username]: created.username }));
      setUsernameDrafts((prev) => ({ ...prev, [created.user_id]: created.username }));
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

  const submitPassword = async (user: SettingsUser) => {
    const nextPassword = passwordDrafts[user.username] ?? "";
    if (nextPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const actionKey = `password:${user.username}`;
    try {
      setPendingAction(actionKey);
      await updateUserPassword(user.username, nextPassword);
      setPasswordDrafts((prev) => ({ ...prev, [user.username]: "" }));
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

    const nextUsername = normalizeUsername(usernameDrafts[user.user_id] ?? user.username);
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
      setUsernameDrafts((prev) => ({ ...prev, [updated.user_id]: updated.username }));

      const nextDisplayNames: UserDisplayNames = { ...displayNames };
      const previousDisplayName =
        (displayNames[user.username] ?? displayNameDrafts[user.username] ?? user.username).trim() || updated.username;

      delete nextDisplayNames[user.username];
      nextDisplayNames[updated.username] = previousDisplayName;

      await patchPreferences({ userDisplayNames: nextDisplayNames });
      setDisplayNames(nextDisplayNames);
      setDisplayNameDrafts((prev) => {
        const next = { ...prev };
        const previous = (next[user.username] ?? user.username).trim() || updated.username;
        delete next[user.username];
        next[updated.username] = previous;
        return next;
      });
      setPasswordDrafts((prev) => {
        const next = { ...prev };
        const previous = next[user.username] ?? "";
        delete next[user.username];
        next[updated.username] = previous;
        return next;
      });
      publishDisplayNames(nextDisplayNames);
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

  const saveDisplayName = async (username: string) => {
    const actionKey = `display:${username}`;
    const nextMap: UserDisplayNames = {
      ...displayNames,
      [username]: (displayNameDrafts[username] ?? "").trim() || username,
    };

    try {
      setPendingAction(actionKey);
      await patchPreferences({ userDisplayNames: nextMap });
      setDisplayNames(nextMap);
      publishDisplayNames(nextMap);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save display name");
    } finally {
      setPendingAction(null);
    }
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
              <th className="px-3 py-2">Password</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedUsers.map((user) => {
              const isSelf = user.username === currentUsername;
              const usernameKey = `username:${user.user_id}`;
              const statusKey = `status:${user.username}`;
              const passwordKey = `password:${user.username}`;
              const deleteKey = `delete:${user.username}`;
              const displayKey = `display:${user.username}`;

              const usernameDraft = normalizeUsername(usernameDrafts[user.user_id] ?? user.username);
              const usernameError = validateUsername(usernameDraft);
              const hasDuplicateUsername = sortedUsers.some(
                (item) => item.user_id !== user.user_id && normalizeUsername(item.username) === usernameDraft,
              );
              const canSaveUsername =
                !usernameError &&
                !hasDuplicateUsername &&
                usernameDraft !== user.username &&
                pendingAction !== usernameKey &&
                !isSelf;

              return (
                <tr key={user.user_id} className="bg-black/10 text-slate-200">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none"
                        value={usernameDrafts[user.user_id] ?? user.username}
                        onChange={(event) =>
                          setUsernameDrafts((prev) => ({
                            ...prev,
                            [user.user_id]: event.target.value,
                          }))
                        }
                        placeholder="username"
                        disabled={isSelf}
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs transition hover:bg-white/15 disabled:opacity-60"
                        disabled={!canSaveUsername}
                        onClick={() => {
                          void submitRenameUser(user);
                        }}
                      >
                        {pendingAction === usernameKey ? "Saving..." : "Save"}
                      </button>
                    </div>
                    {isSelf ? <span className="mt-1 inline-block text-xs text-slate-300">(you)</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none"
                        value={displayNameDrafts[user.username] ?? displayNames[user.username] ?? user.username}
                        onChange={(event) =>
                          setDisplayNameDrafts((prev) => ({
                            ...prev,
                            [user.username]: event.target.value,
                          }))
                        }
                        placeholder="Display name"
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs transition hover:bg-white/15 disabled:opacity-60"
                        disabled={pendingAction === displayKey}
                        onClick={() => {
                          void saveDisplayName(user.username);
                        }}
                      >
                        {pendingAction === displayKey ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </td>
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
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-100 outline-none"
                        value={passwordDrafts[user.username] ?? ""}
                        onChange={(event) =>
                          setPasswordDrafts((prev) => ({ ...prev, [user.username]: event.target.value }))
                        }
                        placeholder="new password"
                      />
                      <button
                        type="button"
                        className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs transition hover:bg-white/15 disabled:opacity-60"
                        disabled={pendingAction === passwordKey || (passwordDrafts[user.username] ?? "").length < 6}
                        onClick={() => {
                          void submitPassword(user);
                        }}
                      >
                        {pendingAction === passwordKey ? "Saving..." : "Update"}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
