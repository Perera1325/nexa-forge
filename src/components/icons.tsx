import type { ReactNode } from 'react';
import type { BlockKind } from '../types';

interface IconProps {
  size?: number;
}

function Svg({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const PlayIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4.5 3v10l8-5z" />
  </Svg>
);
export const StopIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="8" height="8" rx="1" />
  </Svg>
);
export const BracesIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 2.5c-1.5 0-2 .7-2 2v2c0 1-.5 1.5-1.5 1.5C3.5 8 4 8.5 4 9.5v2c0 1.3.5 2 2 2M10 2.5c1.5 0 2 .7 2 2v2c0 1 .5 1.5 1.5 1.5-1 0-1.5.5-1.5 1.5v2c0 1.3-.5 2-2 2" />
  </Svg>
);
export const BoxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 1.5l5.5 3v6.5L8 14.5 2.5 11V4.5z" />
    <path d="M2.5 4.5L8 7.5l5.5-3M8 7.5v7" />
  </Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5M7 7v4M9 7v4" />
  </Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="4" />
    <path d="M10 10l3.5 3.5" />
  </Svg>
);
export const BlocksIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </Svg>
);
export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" />
    <circle cx="10.5" cy="4.5" r="1.5" />
    <circle cx="5.5" cy="11.5" r="1.5" />
  </Svg>
);
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
  </Svg>
);
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8.5l3.2 3L13 4.5" />
  </Svg>
);

export function LogoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true" focusable="false">
      <path d="M4 14.5V3.5l10 11v-11" />
    </svg>
  );
}

const BLOCK_ICONS: Record<BlockKind, ReactNode> = {
  sensor: <path d="M1.5 8h2.5l1.5-4.5 3 9 1.5-4.5h4.5" />,
  logic: (
    <>
      <circle cx="4" cy="3.5" r="1.5" />
      <circle cx="4" cy="12.5" r="1.5" />
      <circle cx="12" cy="6" r="1.5" />
      <path d="M4 5v6M4 9c0-2 2-3 6.5-3" />
    </>
  ),
  mqtt: (
    <>
      <circle cx="8" cy="8" r="1.5" />
      <path d="M4.8 4.8a4.5 4.5 0 0 0 0 6.4M11.2 4.8a4.5 4.5 0 0 1 0 6.4M2.6 2.6a7.5 7.5 0 0 0 0 10.8M13.4 2.6a7.5 7.5 0 0 1 0 10.8" />
    </>
  ),
  cloudApi: <path d="M4.5 12.5a3 3 0 0 1-.4-5.97 4 4 0 0 1 7.7 1A2.5 2.5 0 0 1 11.5 12.5z" />,
  docker: (
    <>
      <path d="M8 1.5l5.5 3v6.5L8 14.5 2.5 11V4.5z" />
      <path d="M2.5 4.5L8 7.5l5.5-3M8 7.5v7" />
    </>
  ),
  kubernetes: (
    <>
      <path d="M8 1.5l5.2 3v7L8 14.5l-5.2-3v-7z" />
      <circle cx="8" cy="8" r="1.8" />
    </>
  ),
};

export function BlockIcon({ kind, size }: { kind: BlockKind; size?: number }) {
  return <Svg size={size}>{BLOCK_ICONS[kind]}</Svg>;
}
