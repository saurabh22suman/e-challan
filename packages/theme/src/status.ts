import { tokens } from './tokens.js';

/**
 * Semantic status vocabulary shared by the tablet and admin apps.
 *
 * Status is always labelled; colour is never the only signal. Solid green stays
 * reserved for the challan commit action, so every status tone below is a tint
 * with an outline and a matching foreground.
 */

/** The six semantic tones from docs/design.md §3.3. */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'cancelled';

/** Application states that have an agreed visual meaning. */
export type StatusKind =
  | 'active'
  | 'deactivated'
  | 'issued'
  | 'under_review'
  | 'resolved'
  | 'cancelled'
  | 'online'
  | 'offline'
  | 'draft'
  | 'sending'
  | 'send_failed';

export interface ToneStyle {
  readonly bg: string;
  readonly fg: string;
  readonly border: string;
}

export const toneStyles: Record<Tone, ToneStyle> = tokens.tone;

const STATUS_TONE: Record<StatusKind, Tone> = {
  active: 'success',
  deactivated: 'neutral',
  issued: 'info',
  under_review: 'warning',
  resolved: 'success',
  cancelled: 'cancelled',
  online: 'success',
  offline: 'warning',
  draft: 'info',
  sending: 'info',
  send_failed: 'danger',
};

const STATUS_LABEL: Record<StatusKind, string> = {
  active: 'Active',
  deactivated: 'Deactivated',
  issued: 'Issued',
  under_review: 'Under Review',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
  online: 'Online',
  offline: 'Offline',
  draft: 'Draft',
  sending: 'Sending',
  send_failed: 'Send failed',
};

export type ChallanStatus = 'Issued' | 'Under Review' | 'Resolved' | 'Cancelled';

const CHALLAN_STATUS_KIND: Record<ChallanStatus, StatusKind> = {
  Issued: 'issued',
  'Under Review': 'under_review',
  Resolved: 'resolved',
  Cancelled: 'cancelled',
};

export function statusTone(kind: StatusKind): Tone {
  return STATUS_TONE[kind];
}

export function statusLabel(kind: StatusKind): string {
  return STATUS_LABEL[kind];
}

/** Map a server challan status string to its semantic badge kind. */
export function challanStatusKind(status: ChallanStatus): StatusKind {
  return CHALLAN_STATUS_KIND[status];
}
