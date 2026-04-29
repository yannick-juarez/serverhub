import * as React from "react";

export type PolarstarProps = {
    size?: number;
    color?: string;
    thickness?: number;
    "aria-label"?: string;
    className?: string;
    style?: React.CSSProperties;
};

export default function Polarstar({
    size = 96,
    color = "currentColor",
    thickness,
    "aria-label": ariaLabel,
    className,
    style,
}: PolarstarProps) {
    const t = Math.max(2, Math.round(thickness ?? size * 0.1));

    const rootStyle: React.CSSProperties = {
        ...style,
        width: `${size}px`,
        height: `${size}px`,
        "--ps-color": color,
        "--ps-thickness": `${t}px`,
        filter: `drop-shadow(0 0 calc(var(--ps-thickness) * 0.9) color-mix(in srgb, var(--ps-color), transparent 55%))`,
    } as React.CSSProperties;

    const barStyle: React.CSSProperties = {
        borderRadius: "999px",
        background: color,
    };

    const decorative = !ariaLabel;

    return (
        <div
            className={`relative inline-block pointer-events-none ${className || ""}`}
            style={rootStyle}
            role={decorative ? undefined : "img"}
            aria-label={decorative ? undefined : ariaLabel}
            aria-hidden={decorative ? true : undefined}
        >
            {/* Vertical stem */}
            <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                    ...barStyle,
                    width: `${t}px`,
                    height: `${size}px`,
                }}
            />

            {/* Crossing diagonals */}
            <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                    ...barStyle,
                    width: `${t}px`,
                    height: `${size * 0.8}px`,
                    transform: `translate(-50%, -50%) rotate(66deg)`,
                }}
            />
            <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{
                    ...barStyle,
                    width: `${t}px`,
                    height: `${size * 0.8}px`,
                    transform: `translate(-50%, -50%) rotate(-66deg)`,
                }}
            />
            <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60"
                style={{
                    ...barStyle,
                    width: `${t / 2}px`,
                    height: `${size * 0.4}px`,
                    transform: `translate(-50%, -50%) rotate(-38deg)`,
                }}
            ></div>
            <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60"
                style={{
                    ...barStyle,
                    width: `${t / 2}px`,
                    height: `${size * 0.4}px`,
                    transform: `translate(-50%, -50%) rotate(38deg)`,
                }}
            ></div>
            <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60"
                style={{
                    ...barStyle,
                    width: `${t / 2}px`,
                    height: `${size * 0.4}px`,
                    transform: `translate(-50%, -50%) rotate(90deg)`,
                }}
            ></div>
        </div>
    );
}
