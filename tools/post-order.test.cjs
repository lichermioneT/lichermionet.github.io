'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const hexoRequire = createRequire(require.resolve('hexo/package.json'));
const WarehouseModule = hexoRequire('warehouse');
const Warehouse = WarehouseModule.default || WarehouseModule;
const { normalizeOrder, SORT_FIELDS } = require('./lib/post-order.cjs');

const valid = [[1, 1], [26, 26], ['2', 2], [' 03 ', 3], ['10.0', 10], [9999, 9999]];
for (const [raw, expected] of valid) test(`valid order ${JSON.stringify(raw)}`, () => assert.equal(normalizeOrder(raw), expected));
const invalid = [undefined, null, '', ' ', 0, -1, 1.5, 'abc', true, false, [], {}, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1];
for (let i = 0; i < invalid.length; i++) test(`invalid order case ${i + 1} sorts last`, () => assert.equal(normalizeOrder(invalid[i]), Number.MAX_SAFE_INTEGER));

test('virtual field survives fresh Warehouse queries and order edits', async () => {
  const db = new Warehouse();
  const schema = new Warehouse.Schema({ title: String, date: Date });
  const posts = db.model('Post', schema);
  // Load the ACTUAL Hexo plugin using the real Warehouse schema, not a mock sort.
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const pluginPath = path.resolve(__dirname, '../scripts/post-order.js');
  vm.runInNewContext(fs.readFileSync(pluginPath, 'utf8'), {
    require: createRequire(pluginPath),
    hexo: {
      model: () => posts,
      extend: { filter: { register() {} }, helper: { register() {} }, generator: { register() {} } }
    }
  }, { filename: pluginPath });
  const date = new Date('2026-01-01T00:00:00Z');
  const one = await posts.insert({ title: 'chapter one', date, order: '1' });
  await posts.insert({ title: 'chapter two', date, order: 2 });
  await posts.insert({ title: 'unassigned', date });
  const titles = () => posts.find({}).sort(SORT_FIELDS).map(post => post.title);
  assert.deepEqual(titles(), ['chapter one', 'chapter two', 'unassigned']);
  assert.deepEqual(titles(), ['chapter one', 'chapter two', 'unassigned']);
  await posts.updateById(one._id, { order: 3 });
  assert.deepEqual(titles(), ['chapter two', 'chapter one', 'unassigned']);
  await posts.updateById(one._id, { order: null });
  assert.deepEqual(titles(), ['chapter two', 'chapter one', 'unassigned']);
});
