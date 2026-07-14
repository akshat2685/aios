import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
(globalThis as any).React = React;
import { ApprovalModal } from '../../../../src/renderer/components/layout/approval-modal';

let effectCallback: any = null;
let stateCallbackRequests: any = null;
let stateCallbackDetails: any = null;
let currentRequests: any[] = [];
let currentDetails = false;

vi.mock('react', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useEffect: (cb: any) => {
      effectCallback = cb;
    },
    useState: (init: any) => {
      if (Array.isArray(init) || init === currentRequests) {
        return [currentRequests, (val: any) => {
          currentRequests = typeof val === 'function' ? val(currentRequests) : val;
          if (stateCallbackRequests) stateCallbackRequests(currentRequests);
        }];
      } else {
        return [currentDetails, (val: any) => {
          currentDetails = typeof val === 'function' ? val(currentDetails) : val;
          if (stateCallbackDetails) stateCallbackDetails(currentDetails);
        }];
      }
    }
  };
});

const mockResolveApproval = vi.fn();
let securityCallback: any = null;
vi.mock('../../../../src/renderer/lib/electron-api', () => ({
  getElectronAPI: () => ({
    security: {
      onRequestApproval: (cb: any) => {
        securityCallback = cb;
        return () => {};
      },
      resolveApproval: mockResolveApproval
    }
  })
}));

vi.mock('lucide-react', () => ({
  ShieldAlert: () => <svg data-testid="shield" />,
  ChevronDown: () => <svg data-testid="chevron-down" />,
  ChevronUp: () => <svg data-testid="chevron-up" />,
  AlertTriangle: () => <svg data-testid="alert" />,
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: (props: any) => <div data-testid="animate-presence" {...props} />,
  motion: {
    div: (props: any) => <div data-testid="motion-div" {...props} />,
  }
}));

describe('ApprovalModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    effectCallback = null;
    currentRequests = [];
    currentDetails = false;
  });

  it('renders nothing when no requests', () => {
    const el = (ApprovalModal as any)({});
    expect(el).toBeNull();
  });

  it('renders request and handles resolution', async () => {
    currentRequests = [{
      id: 'req1',
      agentId: 'agent1',
      action: 'fs.read',
      target: '/etc/passwd',
      risk: 'CRITICAL',
      params: { path: '/etc/passwd' }
    }];
    
    // Mount to trigger effect setup
    let el = (ApprovalModal as any)({});
    expect(typeof el.type).toBe('function');
    
    // Find deny_once button
    const container = el.props.children; // fixed inset-0
    const motionDiv = container.props.children;
    const p6Div = motionDiv.props.children;
    const modalContent = p6Div.props.children;
    const buttonsContainer = modalContent[5]; // grid-cols-2 
    const denyOnceBtn = buttonsContainer.props.children[0];
    
    await denyOnceBtn.props.onClick();
    expect(mockResolveApproval).toHaveBeenCalledWith('req1', 'deny_once');
    expect(currentRequests).toHaveLength(0);
  });
  
  it('toggles details and resolves with other options', async () => {
    currentRequests = [{
      id: 'req2',
      agentId: 'agent2',
      action: 'fs.write',
      target: '/tmp/test',
      risk: 'LOW',
      params: {}
    }];
    currentDetails = true;
    
    let el = (ApprovalModal as any)({});
    
    // Toggle details
    const container = el.props.children;
    const motionDiv = container.props.children;
    const p6Div = motionDiv.props.children;
    const modalContent = p6Div.props.children;
    const toggleBtn = modalContent[3];
    toggleBtn.props.onClick();
    expect(currentDetails).toBe(false);

    // Call allow_always
    const bottomButtonsContainer = modalContent[6];
    const allowAlwaysBtn = bottomButtonsContainer.props.children[2];
    await allowAlwaysBtn.props.onClick();
    
    expect(mockResolveApproval).toHaveBeenCalledWith('req2', 'allow_always');
  });

  it('registers listener in useEffect', () => {
    (ApprovalModal as any)({});
    const cleanup = effectCallback();
    
    // Simulate incoming request
    securityCallback({ id: 'newReq' });
    expect(currentRequests).toHaveLength(1);
    expect(currentRequests[0].id).toBe('newReq');
    
    cleanup();
  });
});
