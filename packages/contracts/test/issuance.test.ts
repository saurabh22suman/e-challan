import { describe, expect, it } from 'vitest';
import {
  AcknowledgementStateSchema,
  CapturedPhotoStoreSchema,
  MAX_PHOTOS,
  MediaFailureReasonSchema,
  MIN_PHOTOS,
  PHOTO_BYTES_HARD_MAX,
  PHOTO_BYTES_TARGET,
  PHOTO_HEIGHT_HARD_MAX,
  PHOTO_QUALITY_FLOOR,
  PHOTO_QUALITY_INITIAL,
  PHOTO_WIDTH_HARD_MAX,
  RefusalSchema,
  SignaturePadSchema,
  SIGNATURE_BYTES_HARD_MAX,
  SIGNATURE_BYTES_TARGET,
  SUMMARY_BINDING_FIELDS,
  deriveSummaryRevision,
  removePhoto,
  wouldExceedPhotoLimit,
} from '../src/index.js';

/**
 * Planner-owned I-02/I-03 acceptance (CAM/SIG contracts, summary binding).
 * Read-only planner input. Missing exports are **surface-absence RED** until
 * the package exposes them.
 */

const ID = (suffix: string): string => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;

describe('I-02 / I-03 issuance contracts (CAM, SIG, summary binding)', () => {
  describe('E-02 client limits', () => {
    it('exposes the agreed JPEG target, hard max and dimensions', () => {
      expect(PHOTO_BYTES_TARGET).toBe(300 * 1024);
      expect(PHOTO_BYTES_HARD_MAX).toBe(800 * 1024);
      expect(PHOTO_WIDTH_HARD_MAX).toBe(1920);
      expect(PHOTO_HEIGHT_HARD_MAX).toBe(1440);
      expect(PHOTO_QUALITY_INITIAL).toBe(0.85);
      expect(PHOTO_QUALITY_FLOOR).toBe(0.6);
      expect(MIN_PHOTOS).toBe(1);
      expect(MAX_PHOTOS).toBe(4);
    });
  });

  describe('PhotoCaptureSchema / CapturedPhotoStoreSchema', () => {
    it('accepts a 1920×1440 JPEG inside the byte budget', () => {
      const id = ID('1');
      const result = CapturedPhotoStoreSchema.safeParse({
        acceptedCount: 1,
        photos: [
          {
            id,
            dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD',
            width: 1920,
            height: 1440,
            bytes: PHOTO_BYTES_HARD_MAX - 1,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects a non-JPEG data url', () => {
      const id = ID('1');
      const result = CapturedPhotoStoreSchema.safeParse({
        acceptedCount: 1,
        photos: [
          {
            id,
            dataUrl: 'data:image/png;base64,abcd',
            width: 100,
            height: 100,
            bytes: 1000,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('rejects photos above the E-02 hard max', () => {
      const id = ID('1');
      const result = CapturedPhotoStoreSchema.safeParse({
        acceptedCount: 1,
        photos: [
          {
            id,
            dataUrl: 'data:image/jpeg;base64,/9j/4AAQ',
            width: 1920,
            height: 1440,
            bytes: PHOTO_BYTES_HARD_MAX + 1,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('blocks a fifth photo via wouldExceedPhotoLimit', () => {
      const store = { acceptedCount: 4, photos: [] };
      expect(wouldExceedPhotoLimit(store)).toBe(true);
    });

    it('removing the last photo invalidates evidence state', () => {
      const id = ID('1');
      const store = {
        acceptedCount: 1,
        photos: [
          {
            id,
            dataUrl: 'data:image/jpeg;base64,/9j/4AAQ',
            width: 100,
            height: 100,
            bytes: 1000,
          },
        ],
      };
      const next = removePhoto(store, id);
      expect(next.photos).toHaveLength(0);
      expect(next.acceptedCount).toBe(0);
    });
  });

  describe('E-03 client limits', () => {
    it('exposes the agreed PNG target and hard max', () => {
      expect(SIGNATURE_BYTES_TARGET).toBe(200 * 1024);
      expect(SIGNATURE_BYTES_HARD_MAX).toBe(500 * 1024);
    });

    it('accepts a PNG signature inside the byte budget', () => {
      const result = SignaturePadSchema.safeParse({
        dataUrl: 'data:image/png;base64,iVBORw0KGgo',
        width: 800,
        height: 300,
        bytes: SIGNATURE_BYTES_HARD_MAX - 1,
      });
      expect(result.success).toBe(true);
    });

    it('rejects a signature above the hard max', () => {
      const result = SignaturePadSchema.safeParse({
        dataUrl: 'data:image/png;base64,iVBORw0KGgo',
        width: 800,
        height: 300,
        bytes: SIGNATURE_BYTES_HARD_MAX + 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('RefusalSchema', () => {
    it('rejects a blank reason', () => {
      const result = RefusalSchema.safeParse({
        reason: '   ',
        witnessName: 'S. Iyer',
        witnessStaffId: 'DEMO-EMP-007',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a blank witness name', () => {
      const result = RefusalSchema.safeParse({
        reason: 'Refused',
        witnessName: '',
        witnessStaffId: 'DEMO-EMP-007',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a blank witness staff id', () => {
      const result = RefusalSchema.safeParse({
        reason: 'Refused',
        witnessName: 'S. Iyer',
        witnessStaffId: '',
      });
      expect(result.success).toBe(false);
    });

    it('accepts a fully populated refusal', () => {
      const result = RefusalSchema.safeParse({
        reason: 'Driver left the scene before signing',
        witnessName: 'S. Iyer',
        witnessStaffId: 'DEMO-EMP-007',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reason).toBe('Driver left the scene before signing');
        expect(result.data.witnessName).toBe('S. Iyer');
        expect(result.data.witnessStaffId).toBe('DEMO-EMP-007');
      }
    });
  });

  describe('AcknowledgementStateSchema and summary revision', () => {
    it('enforces a non-empty summary revision', () => {
      const result = AcknowledgementStateSchema.safeParse({
        summaryRevision: '',
        kind: 'signature',
        signatureId: ID('1'),
      });
      expect(result.success).toBe(false);
    });

    it('publishes the field set that bind a signature/refusal to the summary', () => {
      expect(SUMMARY_BINDING_FIELDS).toEqual([
        'vehicleRegistration',
        'gatePassNumber',
        'driverName',
        'departmentId',
        'contractorId',
        'vehicleTypeId',
        'violationTypeIds',
        'remarks',
        'registry',
      ]);
    });

    it('derives a stable revision that changes when a summary-bound field changes', () => {
      const draft = {
        vehicleRegistration: 'GJ05JP6207',
        gatePassNumber: 'DEMO-GP-0010',
        driverName: 'Kavita Joshi',
        departmentId: ID('4'),
        contractorId: ID('7'),
        vehicleTypeId: ID('8'),
        violationTypeIds: [ID('10')],
        remarks: 'Routine check',
        registry: {
          gatePassRecordId: ID('13'),
          driverId: ID('14'),
          vehicleId: ID('15'),
        },
      };
      const preview = {
        severity: 'Minor',
        occurrenceNumber: 1,
        recommendedAction: 'warning_issued' as const,
        duplicateWarning: { required: false, matchedCount: 0 },
      };
      const a = deriveSummaryRevision({ draft, preview, locationId: ID('2') });
      const b = deriveSummaryRevision({ draft, preview, locationId: ID('2') });
      expect(a).toBe(b);

      const changed = deriveSummaryRevision({
        draft: { ...draft, remarks: 'Different remarks' },
        preview,
        locationId: ID('2'),
      });
      expect(changed).not.toBe(a);

      const changedPreview = deriveSummaryRevision({
        draft,
        preview: { ...preview, occurrenceNumber: 2 },
        locationId: ID('2'),
      });
      expect(changedPreview).not.toBe(a);

      const changedLocation = deriveSummaryRevision({
        draft,
        preview,
        locationId: ID('3'),
      });
      expect(changedLocation).not.toBe(a);
    });
  });

  describe('MediaFailureReasonSchema', () => {
    it('lists the approved recovery reasons', () => {
      const reasons = MediaFailureReasonSchema.options;
      expect(reasons).toEqual([
        'permission_denied',
        'permission_dismissed',
        'permission_unsupported',
        'insecure_context',
        'no_camera',
        'camera_busy',
        'encoder_failed',
        'oversized_after_retry',
        'cancelled',
      ]);
    });
  });
});
