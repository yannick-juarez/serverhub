// src/pages/Login.jsx
import { useState, useRef, useEffect } from "react";

import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import Input from "../components/Input";
import useDocumentTitle from "../hooks/useDocumentTitle";
import Polarstar from "../components/Polarstar";
import toast, { Toaster } from "react-hot-toast";
import { apiUrl } from "../config/api";

const Login = () => {
  useDocumentTitle("LOGIN - INTERFACE");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        setIsDarkMode(prev => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const passwordRef = useRef<HTMLInputElement>(null);

  const handleLoginKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordRef.current?.focus();
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  const handleLogin = async () => {
    try {
      const res = await axios.post(apiUrl("/auth/login"), { username, password });

      const token = res.data?.data?.token ?? res.data?.token;
      const loggedUsername = res.data?.data?.username ?? res.data?.username ?? username;
      if (!token || typeof token !== "string") {
        throw new Error("Authentication token missing from login response");
      }

      Cookies.set("token", token);
      if (typeof loggedUsername === "string" && loggedUsername.trim()) {
        Cookies.set("user", loggedUsername.trim());
      }
      navigate("/");
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status || 0;

        if (status >= 400 && status < 500) {
          setError("Invalid username or password");
          toast.error("Invalid username or password");
        } else if (status >= 500) {
          setError("Server error. Please try again later.");
          toast.error("Server error. Please try again later.");
        } else {
          setError("Login failed. Please try again.");
          toast.error("An unexpected error occurred. Please try again.");
        }
      } else {
        setError("Login failed. Please try again.");
        toast.error("An unexpected error occurred. Please try again.");
      }

      console.error(err);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-black text-white font-sans">
      <Toaster position="top-right" reverseOrder={false} containerClassName="mt-12" />
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
      }}>
          <div className="absolute -left-24 -top-32 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute right-0 top-10 h-96 w-96 rounded-full bg-emerald-500/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_45%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-black/60" />
      </div>

      <div className="fixed top-0 left-0 w-full backdrop-blur-md bg-black/20 z-50 py-2 px-6 font-bold flex flex-row items-center justify-between">
        <h1>*Polarstar</h1>
        <div className="flex flex-row items-center justify-center">
          <a href="/login" className="text-xs hover:bg-white hover:text-black py-1 px-2 rounded-sm">Login</a>
          <span className="mx-2 font-light text-gray-500">|</span>
          <a href="/register" className="text-xs hover:bg-white hover:text-black py-1 px-2 rounded-sm">Register</a>
        </div>
      </div>

      <div className="flex flex-col items-center -translate-y-1/2 z-50">
        <Polarstar size={72} color="white" thickness={2} aria-label="Polarstar Logo" className="mb-6 z-50" />

        {/* Login Content */}
        <div className={`relative flex flex-col items-center w-full max-w-72 px-6 bg-black/${isDarkMode ? "30" : "50"} rounded-lg py-5 backdrop-blur-lg text-xs border border-gray-400/10 z-50`}>
          <h2 className="text-lg font-bold mb-4" style={{
            lineHeight: 1.2,
          }}>Connect to Polarstar</h2>
          <div className="w-full space-y-2">
            <Input
              placeholder="Identifier"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={handleLoginKeyDown}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handlePasswordKeyDown}
              ref={passwordRef}
            />
            <div className="w-full border-b border-white/20"></div>
            <button
              className="w-full px-3 py-2 rounded-md bg-white/90 text-black hover:bg-white transition backdrop-blur-md text-xs font-bold"
              onClick={handleLogin}
            >
              Login
            </button>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;