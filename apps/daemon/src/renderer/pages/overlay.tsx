/**
 * Standalone Overlay Page
 *
 * This page renders in a separate, frameless, always-on-top BrowserWindow.
 * It shows the Universal Command Palette globally when the user presses Ctrl+Space.
 */

import { CommandPalette } from '@/components/layout/command-palette';

export default function OverlayPage() {
  return <CommandPalette standalone />;
}
