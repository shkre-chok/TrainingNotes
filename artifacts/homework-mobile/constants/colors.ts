/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#3d342f',
    tint: '#3e745f',

    // Core surfaces
    background: '#fbfaf7',
    foreground: '#3d342f',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#3d342f',

    // Primary action color (buttons, links, active states)
    primary: '#3e745f',
    primaryForeground: '#fbfaf7',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#eeeae3',
    secondaryForeground: '#51443c',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#f3f0eb',
    mutedForeground: '#7b7169',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f1e3d8',
    accentForeground: '#7d4c2a',

    // Destructive actions (delete, error states)
    destructive: '#bf5140',
    destructiveForeground: '#fbfaf7',

    // Borders and input outlines
    border: '#dfd8cf',
    input: '#dfd8cf',
  },
  dark: {
    text: '#e9e1d6',
    tint: '#67a38c',
    background: '#251f1d',
    foreground: '#e9e1d6',
    card: '#2b2421',
    cardForeground: '#e9e1d6',
    primary: '#67a38c',
    primaryForeground: '#201b19',
    secondary: '#403431',
    secondaryForeground: '#dfd4c7',
    muted: '#362c29',
    mutedForeground: '#b4a79c',
    accent: '#563a2d',
    accentForeground: '#f1c9a7',
    destructive: '#cf6554',
    destructiveForeground: '#fbfaf7',
    border: '#4a3c37',
    input: '#4a3c37',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
