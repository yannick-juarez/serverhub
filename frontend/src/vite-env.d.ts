/// <reference types="vite/client" />

import type React from "react";

declare module "react" {
	namespace JSX {
		interface IntrinsicElements {
			"model-viewer": React.DetailedHTMLProps<
				React.HTMLAttributes<HTMLElement>,
				HTMLElement
			> & {
				src?: string;
				alt?: string;
				poster?: string;
				exposure?: number | string;
				shadowIntensity?: number | string;
				autoRotate?: boolean;
				rotationPerSecond?: string;
				cameraControls?: boolean;
				disableZoom?: boolean;
				interactionPrompt?: string;
				"shadow-intensity"?: string;
				"auto-rotate"?: boolean;
				"rotation-per-second"?: string;
				"camera-controls"?: boolean;
				"disable-zoom"?: boolean;
				"interaction-prompt"?: string;
			};
		}
	}
}
