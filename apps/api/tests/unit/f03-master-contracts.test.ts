import { describe, expect, it } from 'vitest';
import {
  MASTER_KINDS,
  MasterKindSchema,
  MasterListResponseSchema,
  MasterRecordSchema,
  MasterResponseSchema,
  masterRequestSchema,
} from '@echallan/contracts';

/**
 * Planner-owned F-03 acceptance (MST-01/02/03, contract layer): the shared master
 * contracts are strict, kind-specific and bounded.
 *
 * These are read-only planner inputs. Do not replace, skip or weaken these assertions.
 */

const SIMPLE_KINDS = ['departments', 'contractors', 'locations', 'vehicle-types'] as const;
const UUID = '00000000-0000-4000-8000-000000000001';

describe('DOM/MST: master-data contracts', () => {
  it('exposes exactly the six approved master kinds', () => {
    expect([...MASTER_KINDS].sort()).toEqual(
      [
        'contractors',
        'departments',
        'gates',
        'locations',
        'vehicle-types',
        'violation-types',
      ].sort(),
    );
    expect(MasterKindSchema.safeParse('posts').success).toBe(false);
    expect(MasterKindSchema.safeParse('unicorns').success).toBe(false);
  });

  it.each(SIMPLE_KINDS)('%s create accepts exactly a trimmed label', (kind) => {
    const schema = masterRequestSchema(kind, 'create');
    const parsed = schema.safeParse({ label: '  Road Works  ' });
    expect(parsed.success).toBe(true);
    expect((parsed.data as { label: string }).label).toBe('Road Works');

    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ label: '   ' }).success).toBe(false);
    expect(schema.safeParse({ label: 'x'.repeat(121) }).success).toBe(false);
    expect(schema.safeParse({ label: 'ok', severity: 'Minor' }).success).toBe(false);
    expect(schema.safeParse({ label: 'ok', locationId: UUID }).success).toBe(false);
  });

  it.each(SIMPLE_KINDS)('%s update requires the label and nothing else', (kind) => {
    const schema = masterRequestSchema(kind, 'update');
    expect(schema.safeParse({ label: 'Renamed' }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ label: 'Renamed', severity: 'Minor' }).success).toBe(false);
  });

  it('violation types require an approved severity on create and allow an optional action', () => {
    const schema = masterRequestSchema('violation-types', 'create');
    expect(schema.safeParse({ label: 'No helmet', severity: 'Major' }).success).toBe(true);
    expect(
      schema.safeParse({ label: 'No helmet', severity: 'Major', defaultAction: 'warning_issued' })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ label: 'No helmet', severity: 'Major', defaultAction: null }).success,
    ).toBe(true);
    expect(schema.safeParse({ label: 'No helmet' }).success).toBe(false);
    expect(schema.safeParse({ label: 'No helmet', severity: 'Unknown' }).success).toBe(false);
    expect(
      schema.safeParse({ label: 'No helmet', severity: 'Minor', defaultAction: 'invented' })
        .success,
    ).toBe(false);
  });

  it('violation type updates accept any subset, including clearing the action', () => {
    const schema = masterRequestSchema('violation-types', 'update');
    expect(schema.safeParse({ label: 'Renamed' }).success).toBe(true);
    expect(schema.safeParse({ severity: 'Critical' }).success).toBe(true);
    expect(schema.safeParse({ defaultAction: null }).success).toBe(true);
    expect(schema.safeParse({ severity: 'Critical', defaultAction: null }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ severity: 'Unknown' }).success).toBe(false);
    expect(schema.safeParse({ label: 'Renamed', isActive: false }).success).toBe(false);
  });

  it('gates require an existing location id on create and cannot move on update', () => {
    const create = masterRequestSchema('gates', 'create');
    expect(create.safeParse({ label: 'Gate 3', locationId: UUID }).success).toBe(true);
    expect(create.safeParse({ label: 'Gate 3' }).success).toBe(false);
    expect(create.safeParse({ label: 'Gate 3', locationId: 'not-a-uuid' }).success).toBe(false);
    expect(create.safeParse({ label: 'Gate 3', locationId: UUID, severity: 'Minor' }).success).toBe(
      false,
    );

    const update = masterRequestSchema('gates', 'update');
    expect(update.safeParse({ label: 'Gate 3 renamed' }).success).toBe(true);
    expect(update.safeParse({ label: 'Gate 3 renamed', locationId: UUID }).success).toBe(false);
    expect(update.safeParse({}).success).toBe(false);
  });

  it('records are strict, kind-specific and carry only their kind-owned fields', () => {
    const department = { id: UUID, kind: 'departments', label: 'Public Works', isActive: true };
    const violation = {
      id: UUID,
      kind: 'violation-types',
      label: 'No helmet',
      isActive: true,
      severity: 'Major',
      defaultAction: null,
    };
    const gate = { id: UUID, kind: 'gates', label: 'Gate 3', isActive: true, locationId: UUID };

    // A record of any kind is still strict about unknown or mistyped fields.
    expect(MasterRecordSchema.safeParse(department).success).toBe(true);
    expect(MasterRecordSchema.safeParse({ ...department, invented: true }).success).toBe(false);
    expect(MasterRecordSchema.safeParse({ ...department, isActive: 'yes' }).success).toBe(false);
    expect(MasterRecordSchema.safeParse({ ...department, id: 'not-a-uuid' }).success).toBe(false);

    // A department (and every label-only kind) owns no other master field.
    expect(MasterRecordSchema.safeParse({ ...department, severity: 'Minor' }).success).toBe(false);
    expect(MasterRecordSchema.safeParse({ ...department, defaultAction: 'custom' }).success).toBe(
      false,
    );
    expect(MasterRecordSchema.safeParse({ ...department, locationId: UUID }).success).toBe(false);

    // A violation type owns severity and default action, never a location.
    expect(MasterRecordSchema.safeParse(violation).success).toBe(true);
    expect(
      MasterRecordSchema.safeParse({ ...violation, defaultAction: 'warning_issued' }).success,
    ).toBe(true);
    expect(MasterRecordSchema.safeParse({ ...violation, locationId: UUID }).success).toBe(false);
    expect(
      MasterRecordSchema.safeParse({
        id: UUID,
        kind: 'violation-types',
        label: 'No helmet',
        isActive: true,
      }).success,
      'a violation type must carry its severity',
    ).toBe(false);

    // A gate owns its location, never a severity or action.
    expect(MasterRecordSchema.safeParse(gate).success).toBe(true);
    expect(MasterRecordSchema.safeParse({ ...gate, severity: 'Minor' }).success).toBe(false);
    expect(MasterRecordSchema.safeParse({ ...gate, defaultAction: 'custom' }).success).toBe(false);
    expect(
      MasterRecordSchema.safeParse({ id: UUID, kind: 'gates', label: 'Gate 3', isActive: true })
        .success,
      'a gate must carry its location',
    ).toBe(false);

    expect(MasterResponseSchema.safeParse({ master: department }).success).toBe(true);
    expect(MasterResponseSchema.safeParse({ master: violation }).success).toBe(true);
    expect(MasterResponseSchema.safeParse({ master: gate }).success).toBe(true);
    expect(MasterResponseSchema.safeParse(department).success).toBe(false);
  });

  it('a list is homogeneous: every record matches the declared kind', () => {
    const department = { id: UUID, kind: 'departments', label: 'Public Works', isActive: true };
    const gate = { id: UUID, kind: 'gates', label: 'Gate 3', isActive: true, locationId: UUID };
    const violation = {
      id: UUID,
      kind: 'violation-types',
      label: 'No helmet',
      isActive: true,
      severity: 'Major',
      defaultAction: null,
    };

    expect(
      MasterListResponseSchema.safeParse({ kind: 'departments', masters: [department] }).success,
    ).toBe(true);
    expect(
      MasterListResponseSchema.safeParse({ kind: 'departments', masters: [department, gate] })
        .success,
      'a department list must not contain a gate record',
    ).toBe(false);
    expect(
      MasterListResponseSchema.safeParse({ kind: 'gates', masters: [department] }).success,
    ).toBe(false);
    expect(
      MasterListResponseSchema.safeParse({ kind: 'violation-types', masters: [violation] }).success,
    ).toBe(true);
    expect(
      MasterListResponseSchema.safeParse({ kind: 'violation-types', masters: [gate] }).success,
    ).toBe(false);
    expect(
      MasterListResponseSchema.safeParse({ kind: 'departments', masters: [department], extra: 1 })
        .success,
    ).toBe(false);
  });

  it('every approved kind has a valid record and a valid homogeneous list', () => {
    const variants: Array<{
      kind: (typeof MASTER_KINDS)[number];
      record: Record<string, unknown>;
    }> = [
      {
        kind: 'departments',
        record: { id: UUID, kind: 'departments', label: 'Public Works', isActive: true },
      },
      {
        kind: 'contractors',
        record: { id: UUID, kind: 'contractors', label: 'Example Contractor', isActive: false },
      },
      {
        kind: 'locations',
        record: { id: UUID, kind: 'locations', label: 'Main gate', isActive: true },
      },
      {
        kind: 'vehicle-types',
        record: { id: UUID, kind: 'vehicle-types', label: 'Truck', isActive: true },
      },
      {
        kind: 'violation-types',
        record: {
          id: UUID,
          kind: 'violation-types',
          label: 'No helmet',
          isActive: true,
          severity: 'Critical',
          defaultAction: 'safety_counselling_completed',
        },
      },
      {
        kind: 'gates',
        record: { id: UUID, kind: 'gates', label: 'Gate 3', isActive: true, locationId: UUID },
      },
    ];

    for (const { kind, record } of variants) {
      expect(MasterRecordSchema.safeParse(record).success, `record for ${kind}`).toBe(true);
      expect(
        MasterListResponseSchema.safeParse({ kind, masters: [record] }).success,
        `list for ${kind}`,
      ).toBe(true);
    }
  });

  it('dispatch returns the kind-specific schema for every approved combination', () => {
    for (const kind of MASTER_KINDS) {
      const create = masterRequestSchema(kind, 'create');
      const update = masterRequestSchema(kind, 'update');
      expect(create).toBeDefined();
      expect(update).toBeDefined();
      expect(create).not.toBe(update);
    }
  });
});
