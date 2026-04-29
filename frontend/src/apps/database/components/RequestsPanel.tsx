import { Dispatch, SetStateAction } from "react";
import { FaFolder, FaPlusCircle } from "react-icons/fa";
import { FaMagnifyingGlass } from "react-icons/fa6";
import { Scrollbar } from "smooth-scrollbar-react";
import { RequestFolder, SqlRequest } from "../../../api/requests";
import IconButton from "../../../ui/IconButton";

export type RequestInlineEditingItem = {
  type: "folder" | "request";
  id?: string;
  parentFolderId?: string | null;
};

export type RequestRenamingItem = {
  type: "folder" | "request";
  id: string;
  value: string;
};

export type RequestContextMenuState = {
  x: number;
  y: number;
  type: "folder" | "request" | "empty";
  id?: string;
};

type RequestsPanelProps = {
  requestFilter: string;
  isLoadingRequests: boolean;
  requestsError: string;
  hasSelectedDatabase: boolean;
  requestFolders: RequestFolder[];
  requestItems: SqlRequest[];
  filteredRequestFolders: RequestFolder[];
  requestsByFolder: Map<string, SqlRequest[]>;
  ungroupedRequests: SqlRequest[];
  selectedRequestId: string | null;
  inlineEditingItem: RequestInlineEditingItem | null;
  inlineEditingValue: string;
  renamingItem: RequestRenamingItem | null;
  requestContextMenu: RequestContextMenuState | null;
  onRequestFilterChange: (value: string) => void;
  setInlineEditingItem: Dispatch<SetStateAction<RequestInlineEditingItem | null>>;
  setInlineEditingValue: Dispatch<SetStateAction<string>>;
  setRenamingItem: Dispatch<SetStateAction<RequestRenamingItem | null>>;
  setRequestContextMenu: Dispatch<SetStateAction<RequestContextMenuState | null>>;
  setRequestsError: Dispatch<SetStateAction<string>>;
  onCreateFolder: (folderName: string) => void;
  onCreateRequest: (requestName: string, parentFolderId?: string | null) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onRenameRequest: (requestId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onDeleteRequest: (requestId: string) => void;
  onSelectRequest: (request: SqlRequest) => void;
};

const RequestsPanel = ({
  requestFilter,
  isLoadingRequests,
  requestsError,
  hasSelectedDatabase,
  requestFolders,
  requestItems,
  filteredRequestFolders,
  requestsByFolder,
  ungroupedRequests,
  selectedRequestId,
  inlineEditingItem,
  inlineEditingValue,
  renamingItem,
  requestContextMenu,
  onRequestFilterChange,
  setInlineEditingItem,
  setInlineEditingValue,
  setRenamingItem,
  setRequestContextMenu,
  setRequestsError,
  onCreateFolder,
  onCreateRequest,
  onRenameFolder,
  onRenameRequest,
  onDeleteFolder,
  onDeleteRequest,
  onSelectRequest,
}: RequestsPanelProps) => {
  return (
    <aside className="flex w-full max-w-xs flex-col overflow-hidden border-r border-white/10 bg-black/30">
      {requestContextMenu && (
        <div
          className="fixed inset-0"
          onClick={() => setRequestContextMenu(null)}
        />
      )}

      <div className="border-b border-white/10 px-3 py-3">
        <div className="flex items-start justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Requests</h3>
            <p className="text-sm text-slate-400">Manage saved SQL requests</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 focus-within:ring-1 focus-within:ring-white/50">
            <FaMagnifyingGlass className="text-slate-400" />
            <input
              type="text"
              placeholder="Filter requests..."
              value={requestFilter}
              onChange={(e) => onRequestFilterChange(e.target.value)}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
            />
          </div>
          <IconButton
            icon={<FaFolder />}
            onClick={() => {
              setInlineEditingItem({ type: "folder" });
              setInlineEditingValue("");
              setRequestsError("");
            }}
            title="New folder"
            activeClassName="border-amber-300/60 bg-amber-300/30 text-amber-100"
            inactiveClassName="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            className="text-xs p-1.5"
          />
          <IconButton
            icon={<FaPlusCircle />}
            onClick={() => {
              setInlineEditingItem({ type: "request" });
              setInlineEditingValue("");
              setRequestsError("");
            }}
            title="New request"
            activeClassName="border-emerald-300/60 bg-emerald-300/30 text-emerald-100"
            inactiveClassName="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            className="text-xs p-1.5"
          />
        </div>
      </div>

      {requestsError ? (
        <div className="border-b border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">
          {requestsError}
        </div>
      ) : null}

      <div
        className="flex-1 overflow-hidden"
        onContextMenu={(e) => {
          e.preventDefault();
          setRequestContextMenu({ x: e.clientX, y: e.clientY, type: "empty" });
        }}
      >
        <Scrollbar className="h-full space-y-1 p-2">
          {isLoadingRequests ? (
            <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-slate-300">Loading requests...</div>
          ) : null}

          {inlineEditingItem?.type === "folder" && (
            <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 flex items-center gap-1">
              <FaFolder className="text-amber-300/60 text-xs flex-shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Folder name..."
                value={inlineEditingValue}
                onChange={(e) => setInlineEditingValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onCreateFolder(inlineEditingValue);
                  } else if (e.key === "Escape") {
                    setInlineEditingItem(null);
                    setInlineEditingValue("");
                  }
                }}
                onBlur={() => {
                  setInlineEditingItem(null);
                  setInlineEditingValue("");
                }}
                className="flex-1 bg-transparent text-xs text-amber-100 placeholder-amber-300/40 outline-none"
              />
            </div>
          )}

          {filteredRequestFolders.length > 0 && (
            <div className="space-y-1">
              {filteredRequestFolders.map((folder) => {
                const folderRequests = requestsByFolder.get(folder.request_folder_id) || [];
                const isRenaming = renamingItem?.type === "folder" && renamingItem?.id === folder.request_folder_id;
                return (
                  <div key={folder.request_folder_id} className="space-y-1">
                    {isRenaming ? (
                      <div className="rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-1.5 flex items-center gap-2">
                        <FaFolder className="text-amber-300/60 flex-shrink-0 text-xs" />
                        <input
                          autoFocus
                          type="text"
                          value={renamingItem.value}
                          onChange={(e) => setRenamingItem({ ...renamingItem, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onRenameFolder(folder.request_folder_id, renamingItem.value);
                            } else if (e.key === "Escape") {
                              setRenamingItem(null);
                            }
                          }}
                          onBlur={() => setRenamingItem(null)}
                          className="flex-1 bg-transparent text-xs text-amber-100 placeholder-amber-300/40 outline-none font-medium"
                        />
                      </div>
                    ) : (
                      <button
                        onDoubleClick={() => {
                          setRenamingItem({ type: "folder", id: folder.request_folder_id, value: folder.folder_name });
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setRequestContextMenu({ x: e.clientX, y: e.clientY, type: "folder", id: folder.request_folder_id });
                        }}
                        className="flex w-full items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-left text-xs text-slate-200 hover:bg-white/10 transition"
                      >
                        <FaFolder className="text-amber-300/60 flex-shrink-0" />
                        <span className="flex-1 truncate font-medium">{folder.folder_name}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">{folderRequests.length}</span>
                      </button>
                    )}

                    {inlineEditingItem?.type === "request" && inlineEditingItem?.parentFolderId === folder.request_folder_id && (
                      <div className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 flex items-center gap-2 ml-3">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Request name..."
                          value={inlineEditingValue}
                          onChange={(e) => setInlineEditingValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              onCreateRequest(inlineEditingValue, folder.request_folder_id);
                            } else if (e.key === "Escape") {
                              setInlineEditingItem(null);
                              setInlineEditingValue("");
                            }
                          }}
                          onBlur={() => {
                            setInlineEditingItem(null);
                            setInlineEditingValue("");
                          }}
                          className="flex-1 bg-transparent text-xs text-emerald-100 placeholder-emerald-300/40 outline-none"
                        />
                      </div>
                    )}

                    <div className="space-y-1 ml-2">
                      {folderRequests.map((request) => {
                        const isRenamingRequest = renamingItem?.type === "request" && renamingItem?.id === request.request_id;
                        return isRenamingRequest ? (
                          <div key={request.request_id} className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1.5 flex items-center gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={renamingItem.value}
                              onChange={(e) => setRenamingItem({ ...renamingItem, value: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  onRenameRequest(request.request_id, renamingItem.value);
                                } else if (e.key === "Escape") {
                                  setRenamingItem(null);
                                }
                              }}
                              onBlur={() => setRenamingItem(null)}
                              className="flex-1 bg-transparent text-xs text-emerald-100 placeholder-emerald-300/40 outline-none"
                            />
                          </div>
                        ) : (
                          <button
                            key={request.request_id}
                            onClick={() => onSelectRequest(request)}
                            onDoubleClick={() => {
                              setRenamingItem({ type: "request", id: request.request_id, value: request.request_name });
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setRequestContextMenu({ x: e.clientX, y: e.clientY, type: "request", id: request.request_id });
                            }}
                            className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs transition ${
                              selectedRequestId === request.request_id
                                ? "border-amber-400/45 bg-amber-500/10 text-amber-100"
                                : "border-white/10 bg-black/40 text-slate-200 hover:bg-white/10"
                            }`}
                            title={request.sql_text}
                          >
                            <span className="truncate flex-1">{request.request_name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {ungroupedRequests.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs text-slate-400 font-medium px-1 py-1">Ungrouped ({ungroupedRequests.length})</div>
              {inlineEditingItem?.type === "request" && inlineEditingItem?.parentFolderId === null && (
                <div className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1.5 flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Request name..."
                    value={inlineEditingValue}
                    onChange={(e) => setInlineEditingValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onCreateRequest(inlineEditingValue, null);
                      } else if (e.key === "Escape") {
                        setInlineEditingItem(null);
                        setInlineEditingValue("");
                      }
                    }}
                    onBlur={() => {
                      setInlineEditingItem(null);
                      setInlineEditingValue("");
                    }}
                    className="flex-1 bg-transparent text-xs text-emerald-100 placeholder-emerald-300/40 outline-none"
                  />
                </div>
              )}
              {ungroupedRequests.map((request) => {
                const isRenamingRequest = renamingItem?.type === "request" && renamingItem?.id === request.request_id;
                return isRenamingRequest ? (
                  <div key={request.request_id} className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2 py-1.5 flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={renamingItem.value}
                      onChange={(e) => setRenamingItem({ ...renamingItem, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenameRequest(request.request_id, renamingItem.value);
                        } else if (e.key === "Escape") {
                          setRenamingItem(null);
                        }
                      }}
                      onBlur={() => setRenamingItem(null)}
                      className="flex-1 bg-transparent text-xs text-emerald-100 placeholder-emerald-300/40 outline-none"
                    />
                  </div>
                ) : (
                  <button
                    key={request.request_id}
                    onClick={() => onSelectRequest(request)}
                    onDoubleClick={() => {
                      setRenamingItem({ type: "request", id: request.request_id, value: request.request_name });
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setRequestContextMenu({ x: e.clientX, y: e.clientY, type: "request", id: request.request_id });
                    }}
                    className={`flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-xs transition ${
                      selectedRequestId === request.request_id
                        ? "border-amber-400/45 bg-amber-500/10 text-amber-100"
                        : "border-white/10 bg-black/40 text-slate-200 hover:bg-white/10"
                    }`}
                    title={request.sql_text}
                  >
                    <span className="truncate flex-1">{request.request_name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {!isLoadingRequests && filteredRequestFolders.length === 0 && ungroupedRequests.length === 0 && !inlineEditingItem ? (
            <div className="rounded-md border border-white/10 bg-white/5 px-2 py-2 text-center text-xs text-slate-400">
              {hasSelectedDatabase ? "No requests yet" : "Select a database"}
            </div>
          ) : null}
        </Scrollbar>
      </div>

      {requestContextMenu && (
        <div
          className="fixed z-50 min-w-[200px] rounded-lg border border-white/10 bg-slate-800 shadow-xl"
          style={{
            left: `${requestContextMenu.x}px`,
            top: `${requestContextMenu.y}px`,
          }}
        >
          {requestContextMenu.type === "folder" && requestContextMenu.id && (
            <>
              <button
                onClick={() => {
                  const folder = requestFolders.find((f) => f.request_folder_id === requestContextMenu.id);
                  if (folder) {
                    setRenamingItem({ type: "folder", id: folder.request_folder_id, value: folder.folder_name });
                  }
                  setRequestContextMenu(null);
                }}
                className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-white/10 rounded-t-lg"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setInlineEditingItem({ type: "folder" });
                  setInlineEditingValue("");
                  setRequestContextMenu(null);
                }}
                className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-white/10"
              >
                New folder
              </button>
              <button
                onClick={() => {
                  setInlineEditingItem({ type: "request", parentFolderId: requestContextMenu.id });
                  setInlineEditingValue("");
                  setRequestContextMenu(null);
                }}
                className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-white/10"
              >
                New request in folder
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={() => {
                  if (requestContextMenu.id && confirm("Delete this folder and all its requests?")) {
                    onDeleteFolder(requestContextMenu.id);
                  }
                }}
                className="block w-full px-3 py-2 text-left text-rose-200 hover:bg-rose-500/20 rounded-b-lg"
              >
                Delete
              </button>
            </>
          )}
          {requestContextMenu.type === "request" && requestContextMenu.id && (
            <>
              <button
                onClick={() => {
                  const request = requestItems.find((r) => r.request_id === requestContextMenu.id);
                  if (request) {
                    setRenamingItem({ type: "request", id: request.request_id, value: request.request_name });
                  }
                  setRequestContextMenu(null);
                }}
                className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-white/10 rounded-t-lg"
              >
                Rename
              </button>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={() => {
                  if (requestContextMenu.id && confirm("Delete this request?")) {
                    onDeleteRequest(requestContextMenu.id);
                  }
                }}
                className="block w-full px-3 py-2 text-left text-rose-200 hover:bg-rose-500/20 rounded-b-lg"
              >
                Delete
              </button>
            </>
          )}
          {requestContextMenu.type === "empty" && (
            <>
              <button
                onClick={() => {
                  setInlineEditingItem({ type: "folder" });
                  setInlineEditingValue("");
                  setRequestContextMenu(null);
                }}
                className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-white/10 rounded-t-lg"
              >
                New folder
              </button>
              <button
                onClick={() => {
                  setInlineEditingItem({ type: "request" });
                  setInlineEditingValue("");
                  setRequestContextMenu(null);
                }}
                className="block w-full px-3 py-2 text-left text-slate-200 hover:bg-white/10 rounded-b-lg"
              >
                New request
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  );
};

export default RequestsPanel;
