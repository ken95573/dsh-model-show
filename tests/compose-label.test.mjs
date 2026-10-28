/*
 * The composed label, exercised as code instead of as a string.
 *
 * The seat composes `conversation.input.model.label` itself (see edit 9), so the
 * contract worth pinning down is behavioural, not textual:
 *
 *   1. every registration is MOUNTED (an element whose type is the entry's
 *      component) — never invoked during composition, because invoking a hook
 *      component inside our render is what corrupted the composer before;
 *   2. each mounted entry sits behind an error boundary, so a third-party
 *      component that throws blanks only its own box;
 *   3. the label body is DSH's own decorator when present, and the remaining
 *      registrations are appended beside it instead of being dropped.
 *
 * The block is sliced out of the shipped bundle and evaluated with stubbed
 * React primitives, so the assertion runs against the bytes that actually ship.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const BUNDLE = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractComposition() {
  const start = BUNDLE.indexOf('const LabelBoundary = class extends react.Component');
  assert.ok(start > 0, 'composition block must exist in the bundle');
  const classLine = BUNDLE.indexOf('className: "dsh-model-show-label"', start);
  assert.ok(classLine > 0, 'composed row must carry its class name');
  const end = BUNDLE.indexOf('\n\t\t\t};\n', classLine);
  assert.ok(end > 0, 'renderLabel must close');
  return BUNDLE.slice(start, end + '\n\t\t\t};'.length);
}

function harness(entries) {
  const calls = { invoked: 0 };
  class Component {
    constructor(props) {
      this.props = props;
      this.state = {};
    }
  }
  const element = (type, props, key) => ({ type, props: props ?? {}, key });
  const react = { Component, createElement: element };
  const ctx = {
    slots: { entriesOfSlot: () => entries },
    locale: { bind: (namespace) => (key) => `${namespace}:${key}` }
  };
  const factory = new Function(
    'react',
    'react_jsx_runtime',
    'ctx',
    'NS',
    `${extractComposition()}\nreturn renderLabel(arguments[4], arguments[5]);`
  );
  return { factory, react, ctx, calls, element };
}

/** A component stand-in that records any invocation performed outside React. */
function spy(calls, name) {
  const fn = () => {
    calls.invoked += 1;
    return { type: 'span', props: { children: name } };
  };
  Object.defineProperty(fn, 'name', { value: name });
  return fn;
}

const provider = { id: 'deepseek-account', displayName: 'DeepSeek Account' };
const model = { name: 'DeepSeek Account/DeepSeek-V4.1-Flash', originalName: 'DeepSeek-V4.1-Flash' };

test('composition mounts each registration and never invokes it inline', () => {
  const boom = () => {
    throw new Error('third-party exploded');
  };
  const calls = { invoked: 0 };
  const ownSpy = spy(calls, 'OwnDecorator');
  const hookSpy = spy(calls, 'HookDecorator');

  const { factory, react, ctx } = harness([
    { component: ownSpy, locale: 'deepseek-model-label-1017', priority: 0 },
    { component: hookSpy, priority: -0.5 },
    { component: boom, priority: -2 }
  ]);

  const row = factory(react, { jsx: (t, p, k) => ({ type: t, props: p ?? {}, key: k }), jsxs: (t, p, k) => ({ type: t, props: p ?? {}, key: k }) }, ctx, 'dsh-model-show', provider, model);

  assert.equal(row.type, 'span');
  assert.equal(row.props.className, 'dsh-model-show-label', 'the row carries a stable class');

  const children = row.props.children;
  assert.equal(children.length, 4, 'prefix + body + two extras');
  assert.equal(children[0].props.children, 'DeepSeek Account/', 'the provider prefix leads');

  const body = children[1].props.children;
  assert.equal(body.type.name, 'LabelBoundary', 'the body sits behind a boundary');
  assert.equal(body.props.children.type, ownSpy, 'the body is the DSH decorator');

  for (const extra of children.slice(2)) {
    assert.equal(extra.props.children.type.name, 'LabelBoundary', 'every extra sits behind a boundary');
  }

  assert.equal(calls.invoked, 0, 'no decorator may be invoked during composition');
});

test('extras are appended, not dropped, when several plugins register', () => {
  const calls = { invoked: 0 };
  const ownSpy = spy(calls, 'OwnDecorator');
  const first = spy(calls, 'ExtraOne');
  const second = spy(calls, 'ExtraTwo');
  const { factory, react, ctx } = harness([
    { component: ownSpy, locale: 'deepseek-model-label-9999', priority: 0 },
    { component: first, priority: -0.5 },
    { component: second, priority: -1 }
  ]);

  const row = factory(react, { jsx: (t, p, k) => ({ type: t, props: p ?? {}, key: k }), jsxs: (t, p, k) => ({ type: t, props: p ?? {}, key: k }) }, ctx, 'dsh-model-show', provider, model);

  const extras = row.props.children.slice(2);
  assert.equal(extras.length, 2, 'both third-party registrations are kept');
  assert.equal(calls.invoked, 0);
});

test('the platform winner becomes the body when no DSH decorator is registered', () => {
  const calls = { invoked: 0 };
  const winner = spy(calls, 'Winner');
  const other = spy(calls, 'Other');
  const { factory, react, ctx } = harness([
    { component: other, priority: 0 },
    { component: winner, priority: -3 }
  ]);

  const row = factory(react, { jsx: (t, p, k) => ({ type: t, props: p ?? {}, key: k }), jsxs: (t, p, k) => ({ type: t, props: p ?? {}, key: k }) }, ctx, 'dsh-model-show', provider, model);

  const body = row.props.children[1].props.children;
  assert.equal(body.props.children.type, winner, 'the lowest priority wins the body');
  assert.equal(row.props.children.length, 3, 'prefix + body + one extra');
});

test('the error boundary blanks a failing entry and keeps the row', () => {
  const boundaryType = new Function(
    'react',
    `const { jsx } = { jsx: (t, p, k) => ({ type: t, props: p ?? {}, key: k }) };\n` +
      `${extractComposition().slice(0, extractComposition().indexOf('const labelRow'))}\nreturn LabelBoundary;`
  )({ Component: class { constructor(p) { this.props = p; this.state = {}; } } });

  assert.equal(boundaryType.getDerivedStateFromError(new Error('x')).failed, true, 'a throw flips the boundary');
  const failed = boundaryType.prototype.render.call({ state: { failed: true }, props: { children: 'boom' } });
  assert.equal(failed, null, 'a failed boundary renders nothing');
  const healthy = boundaryType.prototype.render.call({ state: { failed: false }, props: { children: 'ok' } });
  assert.equal(healthy, 'ok', 'a healthy boundary renders its child');
});
