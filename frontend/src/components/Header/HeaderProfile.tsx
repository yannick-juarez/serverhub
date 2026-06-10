// HeaderProfile.tsx
import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import Cookies from "js-cookie";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { LockClosedIcon, UserCircleIcon } from "@heroicons/react/24/solid";
import { getMe, getPreferences } from "../../api/settings";

const HeaderProfile = () => {
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState("User");
  const [open, setOpen] = useState(false);

    useEffect(() => {
      let currentUsername = Cookies.get("user") ?? "";

      try {
        const cachedRaw = localStorage.getItem("userDisplayNames");
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as Record<string, string>;
          const cachedName = currentUsername ? cached[currentUsername] : undefined;
          setDisplayName(cachedName || currentUsername || "User");
        } else if (currentUsername) {
          setDisplayName(currentUsername);
        }
      } catch {
        if (currentUsername) setDisplayName(currentUsername);
      }

      const onDisplayNamesUpdated = (event: Event) => {
        const customEvent = event as CustomEvent<Record<string, string>>;
        const map = customEvent.detail ?? {};
        setDisplayName((currentUsername && map[currentUsername]) || currentUsername || "User");
      };

      window.addEventListener("user-display-names-updated", onDisplayNamesUpdated as EventListener);

      const load = async () => {
        const [meResult, prefsResult] = await Promise.allSettled([getMe(), getPreferences()]);
        const username = meResult.status === "fulfilled" ? meResult.value.username : currentUsername;
        if (username) {
          Cookies.set("user", username);
          currentUsername = username;
        }

        const displayNames =
          prefsResult.status === "fulfilled" &&
          prefsResult.value.userDisplayNames &&
          typeof prefsResult.value.userDisplayNames === "object"
            ? (prefsResult.value.userDisplayNames as Record<string, string>)
            : {};

        localStorage.setItem("userDisplayNames", JSON.stringify(displayNames));
        setDisplayName((username && displayNames[username]) || username || "User");
      };

      void load();

      return () => {
        window.removeEventListener("user-display-names-updated", onDisplayNamesUpdated as EventListener);
      };
    }, []);

    useEffect(() => {
      const handlePointerDown = (event: PointerEvent) => {
        const menu = document.getElementById("header-profile-menu");
        if (menu && !menu.contains(event.target as Node)) {
          setOpen(false);
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      };

      window.addEventListener("pointerdown", handlePointerDown);
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("pointerdown", handlePointerDown);
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, []);

    return (
        <div id="header-profile-menu" className="relative">
          <button type="button" className="flex items-center focus:outline-none transition-transform *:hover:cursor-pointer" onClick={() => setOpen((value) => !value)}>
            <UserCircleIcon className="h-5 w-5 m-1 text-white hover:text-white/80 transition" />
            <span className="font-semibold">{displayName}</span>
          </button>
          {open ? (
            <div className="absolute right-0 top-full z-50 mt-1 w-32 origin-top-right rounded-lg border border-white/10 bg-black/40 text-sm text-white backdrop-blur-md focus:outline-none">
              <button className="group flex w-full items-center gap-1 py-2 px-3 text-left hover:bg-white/5" onClick={() => {
                setOpen(false);
                navigate("/settings");
              }}>
                <Cog6ToothIcon className="h-3 w-3 text-white/80" />
                Settings
              </button>
              <div className="h-px bg-white/10" />
              <button className="group flex w-full items-center gap-1 py-2 px-3 text-left text-red-500 hover:bg-white/5" onClick={() => {
                setOpen(false);
                Cookies.remove("user");
                Cookies.remove("token");
                navigate("/login");
              }}>
                <LockClosedIcon className="h-3 w-3 text-red-500" />
                Logout
              </button>
            </div>
          ) : null}
        </div>
    );
}

export default HeaderProfile;