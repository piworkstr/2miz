const fn = () => undefined;
const proxy = new Proxy(fn, { get: (_, k) => (k === '__esModule' ? true : k === 'default' ? proxy : proxy), apply: () => proxy });
module.exports = proxy;
