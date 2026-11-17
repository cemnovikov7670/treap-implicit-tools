/**
 * Public entry point for treap-implicit-tools.
 *
 * Re-exporting from a single module keeps the import surface stable even if the
 * internal file layout changes. Consumers should import from here rather than
 * reaching into core.js directly.
 */

export { ImplicitTreap } from './core.js';
