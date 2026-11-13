// Shared validator for contracts/review.schema.json (JSON Schema 2020-12).
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const schema = JSON.parse(readFileSync(new URL('../contracts/review.schema.json', import.meta.url), 'utf8'));
export const validateReview = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
