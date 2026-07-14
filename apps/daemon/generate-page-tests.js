import fs from 'fs';
import path from 'path';

const pagesDir = path.resolve(__dirname, 'src/renderer/pages');
const testsDir = path.resolve(__dirname, 'tests/pages');

if (!fs.existsSync(testsDir)) {
  fs.mkdirSync(testsDir, { recursive: true });
}

function generateTestFile(fileName, isIndex = false) {
  const componentName = fileName.replace('.tsx', '').replace(/-./g, x => x[1].toUpperCase());
  const capCompName = componentName.charAt(0).toUpperCase() + componentName.slice(1) + 'Page';
  const importPath = isIndex ? '@/pages/diagnostics' : `@/pages/${fileName.replace('.tsx', '')}`;
  
  const content = `import React from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PageComponent from '${importPath}';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('@/lib/electron-api', () => ({
  getElectronAPI: () => ({
    system: { metrics: vi.fn().mockResolvedValue({ cpuUsage: 10, totalMem: 16000000000, freeMem: 8000000000 }) },
    llm: { trackerStats: vi.fn().mockResolvedValue({ totalTokens: 1000, byAgent: { test: { totalTokens: 1000 } } }) },
    config: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(true) },
    plugins: { list: vi.fn().mockResolvedValue([]), toggle: vi.fn().mockResolvedValue(true) },
    security: { getPolicy: vi.fn().mockResolvedValue({}), setPolicy: vi.fn().mockResolvedValue(true) },
    window: { close: vi.fn(), minimize: vi.fn() }
  })
}));

vi.mock('@/stores/app-store', () => ({
  useAppStore: () => ({
    agentStatuses: { test: 'active' },
    isFocusMode: false,
    theme: 'dark'
  })
}));

vi.mock('@/stores/chat-store', () => ({
  useChatStore: () => ({
    messages: [],
    sendMessage: vi.fn(),
    isTyping: false
  })
}));

vi.mock('@/components/layout/agent-launcher', () => ({
  AgentLauncher: () => <div data-testid="agent-launcher">AgentLauncher Mock</div>
}));

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: () => <div data-testid="line-chart" />,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  CartesianGrid: () => <div />,
  BarChart: () => <div data-testid="bar-chart" />,
  Bar: () => <div />,
  AreaChart: () => <div data-testid="area-chart" />,
  Area: () => <div />,
}));

// Mock flow
vi.mock('@xyflow/react', () => ({
  ReactFlow: () => <div data-testid="react-flow" />,
  Background: () => <div />,
  Controls: () => <div />,
  MiniMap: () => <div />,
  useNodesState: () => [[], vi.fn()],
  useEdgesState: () => [[], vi.fn()],
  addEdge: vi.fn()
}));

describe('${fileName} Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly without crashing', async () => {
    let result;
    await act(async () => {
      result = render(<PageComponent />);
    });
    expect(result.container).toBeTruthy();
  });
});
`;
  
  const testFileName = isIndex ? 'diagnostics.test.tsx' : `${fileName.replace('.tsx', '.test.tsx')}`;
  fs.writeFileSync(path.join(testsDir, testFileName), content);
}

const files = fs.readdirSync(pagesDir);
for (const file of files) {
  if (file.endsWith('.tsx')) {
    generateTestFile(file);
  } else if (file === 'diagnostics') {
    generateTestFile('index.tsx', true);
  }
}

console.log('Tests generated!');
