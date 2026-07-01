/**
 * Standalone Launcher Page
 *
 * This page renders in a separate, frameless, always-on-top BrowserWindow.
 * It shows ONLY the Agent Launcher grid — no sidebar, no titlebar, no chrome.
 * The window itself is transparent; the component provides the glassmorphic background.
 */

import { AgentLauncher } from '@/components/layout/agent-launcher';

export default function LauncherPage() {
  return <AgentLauncher standalone />;
}
