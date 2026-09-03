'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TERMINAL_TYPES = new Set(['Succeed', 'Fail']);

function validateStateMachine(definition) {
  const errors = [];
  const states = definition?.States;

  if (!definition?.StartAt) {
    errors.push('StartAt must not be empty.');
  }

  if (!states || typeof states !== 'object' || Object.keys(states).length === 0) {
    errors.push('States must not be empty.');
    return errors;
  }

  if (!states[definition.StartAt]) {
    errors.push(`StartAt target does not exist: ${definition.StartAt}`);
  }

  const targets = [];
  let hasTerminalState = false;

  for (const [name, state] of Object.entries(states)) {
    if (TERMINAL_TYPES.has(state.Type) || state.End === true) {
      hasTerminalState = true;
    }

    if (state.Next) targets.push([name, state.Next]);
    if (state.Default) targets.push([name, state.Default]);
    for (const choice of state.Choices ?? []) {
      if (choice.Next) targets.push([name, choice.Next]);
    }
    for (const catcher of state.Catch ?? []) {
      if (catcher.Next) targets.push([name, catcher.Next]);
    }
  }

  for (const [source, target] of targets) {
    if (!states[target]) {
      errors.push(`${source} points to a missing state: ${target}`);
    }
  }

  if (!hasTerminalState) {
    errors.push('Workflow must contain a terminal state.');
  }

  return errors;
}

if (require.main === module) {
  const file = path.join(__dirname, 'state-machine.template.json');
  const definition = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = validateStateMachine(definition);

  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('State machine definition is structurally valid.');
  }
}

module.exports = {validateStateMachine};
