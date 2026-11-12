export const tolerance = { type: 'object', additionalProperties: false };

export function toolSchema(properties, required = Object.keys(properties)) {
  return { type: 'object', properties, required, additionalProperties: false, ...tolerance };
}

export const SPEC_PARAMETERS = toolSchema({
  goal: { type: 'string', minLength: 1 },
  scope: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1 },
  non_goals: { type: 'array', items: { type: 'string', minLength: 1 } },
  constraints: { type: 'array', items: { type: 'string', minLength: 1 } },
  acceptance_criteria: {
    type: 'array', minItems: 1,
    items: toolSchema({
      id: { type: 'string', pattern: '^AC-[1-9][0-9]*$' },
      text: { type: 'string', minLength: 1 },
    }),
  },
});

export const TODO_SCHEMA = toolSchema({
  id: { type: 'string' },
  goal: { type: 'string', minLength: 1 },
  depends_on: { type: 'array', items: { type: 'string' } },
  ac_ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
  kind: { type: 'string', enum: ['implementation', 'repair'] },
}, ['id', 'goal', 'depends_on', 'ac_ids']);

export const PLAN_PARAMETERS = toolSchema({
  operation: { type: 'string', enum: ['initial', 'add_repair', 'reorder', 'revise_dependencies', 'decision'] },
  todos: { type: 'array', minItems: 1, items: TODO_SCHEMA },
  todo: TODO_SCHEMA,
  order: { type: 'array', items: { type: 'string' }, minItems: 1 },
  dependencies: {
    type: 'array',
    items: toolSchema({ id: { type: 'string' }, depends_on: { type: 'array', items: { type: 'string' } } }, ['id', 'depends_on']),
  },
  decision: { type: 'string', minLength: 1, maxLength: 500 },
  todo_id: { type: 'string' },
}, []);
