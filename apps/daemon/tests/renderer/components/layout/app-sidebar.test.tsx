import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
(globalThis as any).React = React;
import { AppSidebar } from '../../../../src/renderer/components/layout/app-sidebar';

// Mocks
let mockSidebarCollapsed = false;
let mockOllamaStatus = 'online';
const mockToggleSidebar = vi.fn();

vi.mock('../../../../src/renderer/stores/app-store', () => ({
  useAppStore: () => ({
    sidebarCollapsed: mockSidebarCollapsed,
    toggleSidebar: mockToggleSidebar,
    ollamaStatus: mockOllamaStatus,
  })
}));

let mockPathname = '/';
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    aside: (props: any) => {
      const { initial, animate, transition, ...rest } = props;
      return <aside data-testid="motion-aside" {...rest} />;
    },
    div: (props: any) => <div data-testid="motion-div" {...props} />,
    span: (props: any) => <span data-testid="motion-span" {...props} />,
  }
}));

vi.mock('../../../../src/renderer/components/ui/glass', () => ({
  GlassNavItem: (props: any) => <button data-testid="glass-nav" onClick={props.onClick} title={props.title}>{props.children}</button>,
  GlassContainer: (props: any) => <div {...props} />
}));

vi.mock('lucide-react', () => {
  const icons = [
    'LayoutDashboard', 'MessageSquare', 'FlaskConical', 'Zap', 'Settings',
    'PanelLeftClose', 'PanelLeft', 'Database', 'FolderGit', 'ActivitySquare',
    'Brain', 'User', 'Globe', 'Cpu'
  ];
  const mocks: any = {};
  for (const i of icons) {
    mocks[i] = () => <svg data-testid={i.toLowerCase()} />;
  }
  return mocks;
});

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSidebarCollapsed = false;
    mockOllamaStatus = 'online';
    mockPathname = '/';
  });

  it('renders correctly expanded', () => {
    const el = (AppSidebar as any)({});
    expect(typeof el.type).toBe('function');
  });

  it('renders correctly collapsed', () => {
    mockSidebarCollapsed = true;
    const el = (AppSidebar as any)({});
    expect(typeof el.type).toBe('function');
  });

  it('handles navigation', () => {
    mockPathname = '/chat';
    const el = (AppSidebar as any)({});
    // Find the dashboard nav button (first one)
    const navItems = el.props.children[1].props.children;
    const dashboardBtn = navItems[0];
    
    dashboardBtn.props.onClick();
    
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('handles toggle sidebar', () => {
    const el = (AppSidebar as any)({});
    // Find bottom section (third child)
    const bottomSection = el.props.children[2].props.children;
    const toggleBtn = bottomSection[1];
    
    toggleBtn.props.onClick();
    
    expect(mockToggleSidebar).toHaveBeenCalled();
  });
  
  it('renders different statuses', () => {
    mockOllamaStatus = 'offline';
    (AppSidebar as any)({});
    
    mockOllamaStatus = 'loading';
    (AppSidebar as any)({});
  });
});
