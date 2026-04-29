// src/components/Input.tsx
import React, { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return (
    <input
      {...props}
      ref={ref}
      className="w-full px-3 py-2 border border-gray-500/10 rounded-md bg-white/5 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/30 transition text-xs"
    />
  );
});

export default Input;