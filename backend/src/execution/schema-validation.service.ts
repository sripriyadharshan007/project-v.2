import { Injectable, BadRequestException } from '@nestjs/common';
import Ajv, { type JSONSchemaType, type ValidateFunction } from 'ajv';

// ── Converts the project's "flat property map" schema format to a full
//    JSON Schema Draft-07 object schema that Ajv can compile.
//
// Input (stored in workflow.inputSchema):
//  {
//    "amount":   { "type": "number",  "required": true },
//    "country":  { "type": "string",  "required": true },
//    "priority": { "type": "string" }
//  }
//
// Output (standard JSON Schema):
//  {
//    "type": "object",
//    "properties": {
//      "amount":   { "type": "number" },
//      "country":  { "type": "string" },
//      "priority": { "type": "string" }
//    },
//    "required": ["amount", "country"],
//    "additionalProperties": true
//  }

function normaliseSchema(raw: Record<string, any>): Record<string, any> {
  // Already a full JSON Schema object (has "type":"object" at root)
  if (raw && raw.type === 'object' && raw.properties) return raw;

  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, def] of Object.entries(raw)) {
    const { required: isRequired, ...rest } = def as any;
    properties[key] = rest;
    if (isRequired) required.push(key);
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class SchemaValidationService {
  private readonly ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,        // collect all errors, not just first
      strict: false,          // allow unknown Ajv keywords (e.g. "required" inline)
      coerceTypes: false,     // never silently cast types
    });
  }

  /**
   * Validates `data` against `rawSchema`.
   * Throws a `BadRequestException` with structured error details on failure.
   */
  validate(rawSchema: Record<string, any>, data: unknown): void {
    // Nothing to validate if the workflow has no schema
    if (!rawSchema || Object.keys(rawSchema).length === 0) return;

    const jsonSchema = normaliseSchema(rawSchema);
    const validate: ValidateFunction = this.ajv.compile(jsonSchema);

    const valid = validate(data);
    if (!valid) {
      const messages = (validate.errors ?? []).map((e) => {
        const field = e.instancePath
          ? e.instancePath.replace(/^\//, '').replace(/\//g, '.')
          : (e.params as any)?.missingProperty ?? 'root';
        return `"${field}" ${e.message}`;
      });

      throw new BadRequestException({
        message: 'Input schema validation failed',
        errors: messages,
      });
    }
  }
}
