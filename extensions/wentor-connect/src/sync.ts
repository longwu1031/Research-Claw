/**
 * Wentor Connect — Skill Sync & Activity Upload
 *
 * Manages bidirectional synchronization of skills between the local
 * Research-Claw instance and the wentor.ai platform, and uploads
 * periodic research activity summaries.
 */

import { AuthManager } from './auth.js';
import {
  WentorApiClient,
  type SkillEntry,
  type SkillSyncPayload,
  type ActivitySummary,
} from './api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  ok: boolean;
  uploaded: number;
  downloaded: number;
  errors: string[];
}

export interface LocalSkillProvider {
  /** Return the list of locally installed skills. */
  getLocalSkills(): SkillEntry[];
  /** Apply skill configuration downloaded from the platform. */
  applyRemoteSkills(skills: SkillEntry[]): void;
}

export interface ActivityProvider {
  /** Generate a research activity summary for the given period. */
  getActivitySummary(period: string): ActivitySummary | null;
}

// ---------------------------------------------------------------------------
// SyncManager
// ---------------------------------------------------------------------------

export class SyncManager {
  private api: WentorApiClient;
  private auth: AuthManager;
  private skillProvider: LocalSkillProvider | null = null;
  private activityProvider: ActivityProvider | null = null;
  private clientVersion: string;

  constructor(
    api: WentorApiClient,
    auth: AuthManager,
    clientVersion: string = '0.1.0',
  ) {
    this.api = api;
    this.auth = auth;
    this.clientVersion = clientVersion;
  }

  /** Register the local skill provider for two-way sync. */
  setSkillProvider(provider: LocalSkillProvider): void {
    this.skillProvider = provider;
  }

  /** Register the activity provider for periodic uploads. */
  setActivityProvider(provider: ActivityProvider): void {
    this.activityProvider = provider;
  }

  // -----------------------------------------------------------------------
  // Skills sync
  // -----------------------------------------------------------------------

  /**
   * Perform a full bidirectional skills sync.
   *
   * 1. Ensure the auth token is fresh.
   * 2. Upload local skills inventory to wentor.ai.
   * 3. Download any remotely-configured skills.
   * 4. Apply remote config locally.
   */
  async syncSkills(): Promise<SyncResult> {
    const result: SyncResult = { ok: false, uploaded: 0, downloaded: 0, errors: [] };

    if (!this.auth.state.isAuthenticated) {
      result.errors.push('Not authenticated — login first');
      return result;
    }

    const tokenFresh = await this.auth.ensureFreshToken();
    if (!tokenFresh) {
      result.errors.push('Token refresh failed — re-login required');
      return result;
    }

    if (!this.skillProvider) {
      result.errors.push('No skill provider registered');
      return result;
    }

    // Upload local skills
    const localSkills = this.skillProvider.getLocalSkills();
    const payload: SkillSyncPayload = {
      skills: localSkills,
      client_version: this.clientVersion,
      timestamp: new Date().toISOString(),
    };

    const uploadResult = await this.api.syncSkills(payload);
    if (uploadResult.ok && uploadResult.data) {
      result.uploaded = uploadResult.data.synced;
    } else {
      result.errors.push(`Upload failed: ${uploadResult.error ?? 'unknown'}`);
    }

    // Download remote skills
    const downloadResult = await this.api.downloadSkills();
    if (downloadResult.ok && downloadResult.data) {
      const remoteSkills = downloadResult.data.skills;
      result.downloaded = remoteSkills.length;

      // Apply remote config (enable/disable skills, install new ones)
      try {
        this.skillProvider.applyRemoteSkills(remoteSkills);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Apply remote skills failed: ${errMsg}`);
      }
    } else {
      result.errors.push(`Download failed: ${downloadResult.error ?? 'unknown'}`);
    }

    result.ok = result.errors.length === 0;
    return result;
  }

  // -----------------------------------------------------------------------
  // Activity upload
  // -----------------------------------------------------------------------

  /**
   * Upload a research activity summary for the given period.
   *
   * @param period  One of: 'today', 'this_week', 'this_month', or a custom label
   */
  async uploadActivity(period: string = 'today'): Promise<{ ok: boolean; error?: string }> {
    if (!this.auth.state.isAuthenticated) {
      return { ok: false, error: 'Not authenticated' };
    }

    const tokenFresh = await this.auth.ensureFreshToken();
    if (!tokenFresh) {
      return { ok: false, error: 'Token refresh failed' };
    }

    if (!this.activityProvider) {
      return { ok: false, error: 'No activity provider registered' };
    }

    const summary = this.activityProvider.getActivitySummary(period);
    if (!summary) {
      return { ok: false, error: 'No activity data available for the period' };
    }

    const result = await this.api.uploadActivity(summary);
    if (!result.ok) {
      return { ok: false, error: result.error ?? 'Upload failed' };
    }

    return { ok: true };
  }
}
