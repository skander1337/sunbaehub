import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size: number, p: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const IconBell = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M6 9a6 6 0 1 1 12 0v4l2 3H4l2-3V9Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </svg>
);
export const IconArrow = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);
export const IconCheck = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m5 12 4.5 4.5L19 7" />
  </svg>
);
export const IconGlobe = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
  </svg>
);
export const IconShield = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
export const IconClock = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const IconCoin = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.6 2.5 1.5-1 1.3-2.5 1.6-2.5.7-2.5 1.6 1 1.8 2.5 1.8 2.5-.6 2.5-1.5" />
    <path d="M12 6.5v11" />
  </svg>
);
export const IconChevron = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const IconClose = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconStar = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.5Z" />
  </svg>
);
export const IconUser = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" />
  </svg>
);
export const IconPhone = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  </svg>
);
export const IconSend = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m4 12 16-8-4 16-4-6-8-2Z" />
    <path d="m12 14 8-10" />
  </svg>
);
export const IconFlag = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M5 21V4h11l-1.5 4L16 12H5" />
  </svg>
);
export const IconPaperclip = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.5 17a1.6 1.6 0 0 1-2.3-2.3L15 7" />
  </svg>
);
export const IconMenu = ({ size = 20, ...p }: P) => (
  <svg {...base(size, p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
