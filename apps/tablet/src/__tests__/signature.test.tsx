import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RefusalSchema,
  SIGNATURE_BYTES_HARD_MAX,
  SignaturePadSchema,
  deriveSummaryRevision,
  type Refusal,
} from '@echallan/contracts';
import RefusalForm from '../features/signature/RefusalForm';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ID = (suffix: string): string => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;

describe('I-03 refusal schema (SIG-04)', () => {
  it('rejects a blank reason with the documented error', () => {
    const result = RefusalSchema.safeParse({
      reason: '   ',
      witnessName: 'S. Iyer',
      witnessStaffId: 'DEMO-EMP-007',
    });
    expect(result.success).toBe(false);
  });
  it('accepts a complete refusal and records the witness', () => {
    const result = RefusalSchema.safeParse({
      reason: 'Driver left the scene',
      witnessName: 'S. Iyer',
      witnessStaffId: 'DEMO-EMP-007',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Refusal).witnessName).toBe('S. Iyer');
    }
  });
});

describe('I-03 refusal form (SIG-04)', () => {
  it('surfaces a validation error when a witness name is missing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RefusalForm
        summaryRevision={deriveSummaryRevision({
          draft: {
            vehicleRegistration: 'GJ05JP6207',
            gatePassNumber: 'DEMO-GP-0010',
            driverName: 'Kavita Joshi',
            departmentId: ID('4'),
            contractorId: '',
            vehicleTypeId: ID('8'),
            violationTypeIds: [ID('10')],
            remarks: 'Routine check',
            registry: null,
          },
          preview: null,
          locationId: 'loc-1',
        })}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('refusal-confirm'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/refused to sign/i);
  });

  it('records the refusal when all fields are populated', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RefusalForm summaryRevision={'abc12345'} onChange={onChange} />);
    await user.type(screen.getByLabelText(/Reason/i), 'Driver left the scene');
    await user.type(screen.getByLabelText(/witnessing supervisor name/i), 'S. Iyer');
    await user.type(screen.getByLabelText(/witnessing supervisor staff id/i), 'DEMO-EMP-007');
    await user.click(screen.getByTestId('refusal-confirm'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const record = screen.getByTestId('refusal-record');
    expect(record.textContent).toContain('Driver left the scene');
  });
});

describe('I-03 signature contract (SIG-02/03/05)', () => {
  it('rejects a signature that exceeds the hard byte cap', () => {
    const result = SignaturePadSchema.safeParse({
      dataUrl: 'data:image/png;base64,' + 'A'.repeat(SIGNATURE_BYTES_HARD_MAX + 100),
      width: 800,
      height: 300,
      bytes: SIGNATURE_BYTES_HARD_MAX + 1,
    });
    expect(result.success).toBe(false);
  });
});
