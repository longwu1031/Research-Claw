import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import WorkspacePanel from './WorkspacePanel';
import { useGatewayStore } from '../../stores/gateway';
import { useConfigStore } from '../../stores/config';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${key}:${opts.count}`;
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// Mock gateway store with a fake client
const mockRequest = vi.fn();

describe('WorkspacePanel', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    useConfigStore.setState({ theme: 'dark' });
    useGatewayStore.setState({
      client: null,
      state: 'disconnected',
      serverVersion: null,
    });
  });

  it('renders empty state when no data and no client', () => {
    render(<WorkspacePanel />);
    expect(screen.getByText('workspace.empty')).toBeTruthy();
  });

  it('renders upload button in empty state', () => {
    render(<WorkspacePanel />);
    expect(screen.getByText('workspace.upload')).toBeTruthy();
  });

  it('renders file tree section when tree data is loaded', async () => {
    // Provide a connected mock client that returns tree data
    mockRequest.mockImplementation((method: string) => {
      if (method === 'rc.ws.tree') {
        return Promise.resolve({
          tree: [
            {
              name: 'sources',
              path: 'sources',
              type: 'directory',
              children: [
                { name: 'paper.pdf', path: 'sources/paper.pdf', type: 'file', git_status: 'committed' },
              ],
            },
          ],
          workspace_root: '/workspace',
        });
      }
      if (method === 'rc.ws.history') {
        return Promise.resolve({ commits: [], total: 0, has_more: false });
      }
      return Promise.resolve({});
    });

    useGatewayStore.setState({
      client: { isConnected: true, request: mockRequest } as any,
      state: 'connected',
    });

    render(<WorkspacePanel />);

    // Wait for async data load
    const fileTreeLabel = await screen.findByText('workspace.fileTree');
    expect(fileTreeLabel).toBeTruthy();
    expect(await screen.findByText('sources')).toBeTruthy();
    expect(await screen.findByText('paper.pdf')).toBeTruthy();
  });

  it('renders recent changes when commits exist', async () => {
    mockRequest.mockImplementation((method: string) => {
      if (method === 'rc.ws.tree') {
        return Promise.resolve({ tree: [], workspace_root: '/workspace' });
      }
      if (method === 'rc.ws.history') {
        return Promise.resolve({
          commits: [
            {
              hash: 'abc123',
              short_hash: 'abc1',
              message: 'Add introduction section',
              author: 'User',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              files_changed: 2,
            },
          ],
          total: 1,
          has_more: false,
        });
      }
      return Promise.resolve({});
    });

    useGatewayStore.setState({
      client: { isConnected: true, request: mockRequest } as any,
      state: 'connected',
    });

    render(<WorkspacePanel />);

    expect(await screen.findByText('workspace.recentChanges')).toBeTruthy();
    expect(await screen.findByText('Add introduction section')).toBeTruthy();
  });

  it('renders drag-drop zone when data exists', async () => {
    mockRequest.mockImplementation((method: string) => {
      if (method === 'rc.ws.tree') {
        return Promise.resolve({
          tree: [{ name: 'file.tex', path: 'file.tex', type: 'file' }],
          workspace_root: '/workspace',
        });
      }
      if (method === 'rc.ws.history') {
        return Promise.resolve({ commits: [], total: 0, has_more: false });
      }
      return Promise.resolve({});
    });

    useGatewayStore.setState({
      client: { isConnected: true, request: mockRequest } as any,
      state: 'connected',
    });

    render(<WorkspacePanel />);

    expect(await screen.findByText('workspace.dragDrop')).toBeTruthy();
  });
});
