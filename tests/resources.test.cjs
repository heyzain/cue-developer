const {test} = require('node:test');
const assert = require('node:assert/strict');
const resources = require('../resources');

test('legacy links retain their categories without changing data', () => {
  const store = {items:[{id:'1',pack:'Reading',title:'Article'}]};
  const before = JSON.stringify(store);
  assert.deepEqual(resources.categories(store), ['Design','Assets','Build','Other','Reading']);
  assert.equal(JSON.stringify(store), before);
});
test('renaming updates links while preserving their other fields', () => {
  const item = {id:'1',pack:'Design',pinned:true,url:'https://example.com/',openCount:7};
  const store = {items:[item], preferences:{keepOpenAfterLaunch:false}};
  resources.saveCategory(store, 'Inspiration', 'Design');
  assert.deepEqual(store.items[0], {...item,pack:'Inspiration'});
  assert.ok(!resources.categories(store).includes('Design'));
  assert.equal(store.preferences.keepOpenAfterLaunch, false);
});
test('empty custom categories survive serialization and reject duplicates', () => {
  const store = {items:[]};
  resources.saveCategory(store,'Reading');
  assert.ok(resources.categories(JSON.parse(JSON.stringify(store))).includes('Reading'));
  assert.throws(()=>resources.saveCategory(store,'reading'), /already exists/);
  assert.throws(()=>resources.saveCategory(store,'recent'), /different/);
  assert.throws(()=>resources.saveCategory(store,'Unsorted','Other'), /cannot be renamed/);
});
test('imported category names are deduplicated and untrusted text remains plain data', () => {
  assert.deepEqual(resources.categories({categories:['Reading','reading','<img>','Other'],items:[{pack:'Docs'}]}), ['Reading','<img>','Other','Docs']);
});
test('URLs normalize consistently and default titles need no network', () => {
  assert.equal(resources.normalizeUrl(' example.com '), 'https://example.com/');
  assert.equal(resources.titleFromUrl('https://www.example.com/docs'), 'example.com');
  for (const value of ['', 'hello world', 'javascript:alert(1)', 'file:///tmp/a', 'https://user:pass@example.com']) assert.throws(()=>resources.normalizeUrl(value));
});
