import React from 'react';
import { useTheme } from '../theme.jsx';

// Single source for icons — small 14×14 SVG paths.
// Add new icons by adding to `Ic` and pass the key as `name` to <Icon/>.
export const Ic = {
  home:    'M2 7l5-5 5 5v6H2z',
  value:   'M2 12V8h2v4zm4 0V5h2v7zm4 0V3h2v9z',
  sure:    'M2 6h10v6H2zM5 6V3.5h4V6',
  my:      'M2 7l4 4 6-6',
  ana:     'M2 12V4M5 12V7M8 12V9M11 12V5',
  guides:  'M2 2.5h10v9H2zM2 5h10M5 5v6.5',
  news:    'M2 3h10v8H2zM4.5 6h5M4.5 8.5h3',
  sun:     'M7 4a3 3 0 110 6 3 3 0 010-6zM7 .5v1.5M7 11.5V13M.5 7h1.5M11.5 7H13M2.4 2.4l1.1 1.1M10.5 10.5l1.1 1.1M2.4 11.6l1.1-1.1M10.5 3.5l1.1-1.1',
  moon:    'M11.3 8.5A4.5 4.5 0 015.5 2.7a5 5 0 105.8 5.8z',
  search:  'M5.5 1a4.5 4.5 0 013.6 7.2L12 11.1l-.9.9-2.9-2.9A4.5 4.5 0 115.5 1z',
  menu:    'M2 3.5h10M2 7h10M2 10.5h10',
  chev:    'M3 5l3 3 3-3',
  add:     'M6 2v8M2 6h8',
  gear:    'M7 5a2 2 0 110 4 2 2 0 010-4zM7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M2.8 11.2l1.1-1.1M10.1 3.9l1.1-1.1',
  bell:    'M3.5 9.5h7L9.5 8V5a2.5 2.5 0 10-5 0v3zM6 11a1 1 0 002 0',
  lock:    'M3.5 6h7v6h-7zM5 6V4.5a2 2 0 114 0V6M7 8.5v1.2',
  clock:   'M7 1.8a5.2 5.2 0 110 10.4A5.2 5.2 0 017 1.8zM7 4.2V7l2 1.2',
  arr:     'M3 7h8M7 3l4 4-4 4',
  filter:  'M2 3h10L8.5 7v4l-3-1V7z',
  upload:  'M7 9V2M4 5l3-3 3 3M2 11h10',
  refresh: 'M11 6A5 5 0 002 5M3 8a5 5 0 009 1M11 2v4H7M3 10V6h4',
};

export function Icon({ name, size = 14, stroke = 1.6, fill = 'none', style, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill={fill}
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      className={className}
    >
      <path d={Ic[name]} />
    </svg>
  );
}

// Maps nav-tab id → icon name
export const iconFor = (id) =>
  ({ home: 'home', value: 'value', sure: 'sure', mybets: 'my', analytics: 'ana', guides: 'guides', news: 'news' }[id]);

// Vedox brand mark — radial blue chip with the V chevron.
export function VedoxLogo({ size = 28, wordmark = false }) {
  const { theme } = useTheme();
  const variant = theme === 'light' ? 'dark' : 'light';
  const baseUrl = import.meta.env.BASE_URL || '/';
  const src = `${baseUrl}${wordmark ? `vedox-wordmark-${variant}.png` : `vedox-mark-${variant}.png`}`;
  return (
    <img
      className={wordmark ? 'vedox-wordmark' : 'vedox-logo-mark'}
      src={src}
      alt={wordmark ? 'Vedox' : ''}
      aria-hidden={!wordmark}
      style={{
        width: wordmark ? Math.round(size * 3.4) : size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
      }}
    />
  );
}

// Initials for a match string, using the left side of the matchup.
export const initials = (match) =>
  match.split('—')[0].trim().split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase();
