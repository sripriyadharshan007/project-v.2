import { BadRequestException } from '@nestjs/common';
import { SchemaValidationService } from './schema-validation.service';

describe('SchemaValidationService', () => {
  let service: SchemaValidationService;

  beforeEach(() => {
    service = new SchemaValidationService();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should pass when data matches the flat-property schema', () => {
    const schema = {
      amount:   { type: 'number',  required: true },
      country:  { type: 'string',  required: true },
      priority: { type: 'string' },
    };
    expect(() =>
      service.validate(schema, { amount: 250, country: 'US', priority: 'High' }),
    ).not.toThrow();
  });

  it('should pass when data matches a full JSON Schema object', () => {
    const schema = {
      type: 'object',
      properties: {
        amount:  { type: 'number' },
        country: { type: 'string' },
      },
      required: ['amount', 'country'],
    };
    expect(() =>
      service.validate(schema, { amount: 100, country: 'IN' }),
    ).not.toThrow();
  });

  it('should pass with extra fields when additionalProperties is true', () => {
    const schema = {
      amount: { type: 'number', required: true },
    };
    expect(() =>
      service.validate(schema, { amount: 50, extraField: 'allowed' }),
    ).not.toThrow();
  });

  it('should skip validation when schema is empty', () => {
    expect(() => service.validate({}, { anything: true })).not.toThrow();
  });

  // ── Type mismatch ──────────────────────────────────────────────────────────

  it('should throw BadRequestException when a field has wrong type', () => {
    const schema = {
      amount: { type: 'number', required: true },
    };
    expect(() =>
      service.validate(schema, { amount: 'not-a-number' }),
    ).toThrow(BadRequestException);
  });

  it('should include the field name in the error message', () => {
    const schema = {
      amount: { type: 'number', required: true },
    };
    try {
      service.validate(schema, { amount: 'bad' });
      fail('Expected BadRequestException to be thrown');
    } catch (e: any) {
      expect(e.response.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('amount')]),
      );
    }
  });

  // ── Missing required fields ────────────────────────────────────────────────

  it('should throw when a required field is missing', () => {
    const schema = {
      amount:  { type: 'number', required: true },
      country: { type: 'string', required: true },
    };
    // missing "country"
    expect(() =>
      service.validate(schema, { amount: 100 }),
    ).toThrow(BadRequestException);
  });

  it('should report the missing required field name', () => {
    const schema = {
      country: { type: 'string', required: true },
    };
    try {
      service.validate(schema, {});
      fail('Expected BadRequestException to be thrown');
    } catch (e: any) {
      expect(e.response.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('country')]),
      );
    }
  });

  // ── Multiple errors ────────────────────────────────────────────────────────

  it('should collect all field errors (allErrors mode)', () => {
    const schema = {
      amount:  { type: 'number',  required: true },
      country: { type: 'string',  required: true },
    };
    try {
      // both wrong
      service.validate(schema, { amount: 'wrong', country: 99 });
      fail('Expected BadRequestException to be thrown');
    } catch (e: any) {
      expect(e.response.errors.length).toBeGreaterThanOrEqual(2);
    }
  });

  // ── Structured response ────────────────────────────────────────────────────

  it('should throw BadRequestException with message + errors array', () => {
    const schema = { amount: { type: 'number', required: true } };
    try {
      service.validate(schema, { amount: 'bad' });
      fail('Expected BadRequestException to be thrown');
    } catch (e: any) {
      expect(e.response.message).toBe('Input schema validation failed');
      expect(Array.isArray(e.response.errors)).toBe(true);
    }
  });
});
