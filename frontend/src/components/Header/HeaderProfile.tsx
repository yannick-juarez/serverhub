// HeaderProfile.tsx
import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import Cookies from "js-cookie";
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { LockClosedIcon, UserCircleIcon } from "@heroicons/react/24/solid";
import { getMe, getPreferences } from "../../api/settings";

const HeaderProfile = () => {
    const navigate = useNavigate();
    const [displayName, setDisplayName] = useState("User");

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

    return (
        <Menu as="div" className="relative">
          <MenuButton className="flex items-center focus:outline-none transition-transform *:hover:cursor-pointer">
            <UserCircleIcon className="h-5 w-5 m-1 text-white hover:text-white/80 transition" />
            <span className="font-semibold">{displayName}</span>
          </MenuButton>
          <MenuItems
            transition
            anchor="bottom end"
            className="w-32 origin-top-right backdrop-blur-md border border-white/10 rounded-lg bg-black/40 text-sm text-white transition duration-100 ease-out [--anchor-gap:var(--spacing-1)] focus:outline-none data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            <MenuItem>
              <button className="group flex w-full items-center gap-1 py-2 px-3 data-[focus]:bg-white/5" onClick={() => navigate("/settings")}>
              <Cog6ToothIcon className="h-3 w-3 text-white/80" />
              Settings
              </button>
            </MenuItem>
            <div className="h-px bg-white/10" />
            <MenuItem>
              <button className="group flex w-full items-center gap-1 py-2 px-3 data-[focus]:bg-white/5 text-red-500" onClick={() => {
                Cookies.remove("user");
                Cookies.remove("token");
                navigate("/login");
              }}>
                <LockClosedIcon className="h-3 w-3 text-red-500" />
                Logout
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
    );
}

export default HeaderProfile;