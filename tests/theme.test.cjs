const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../theme.js'), 'utf8');

function setup({saved=null, systemDark=false, blocked=false}={}) {
  const storage = new Map([['cue-theme-v1', saved]]);
  const attributes = {};
  const events = {};
  const root = {dataset:{}};
  const button = {
    setAttribute:(name,value)=>{attributes[name]=value},
    querySelector:()=>({style:{setProperty:(name,value)=>{attributes.icon=value}}}),
    addEventListener:(name,callback)=>{events[name]=callback}
  };
  vm.runInNewContext(source, {
    localStorage:{
      getItem:key=>{if(blocked)throw Error('Unavailable');return storage.get(key)},
      setItem:(key,value)=>{if(blocked)throw Error('Unavailable');storage.set(key,value)}
    },
    window:{matchMedia:()=>({matches:systemDark,addEventListener:(_,callback)=>{events.system=callback}})},
    document:{documentElement:root,getElementById:()=>button,addEventListener:(_,callback)=>{events.ready=callback}}
  });
  return {root,attributes,events,storage};
}

test('saved theme applies before DOM ready and toggle persists the next choice', () => {
  const app = setup({saved:'dark'});
  assert.equal(app.root.dataset.theme, 'dark');
  app.events.ready();
  assert.equal(app.attributes['aria-pressed'], 'true');
  assert.equal(app.attributes.icon, "url('assets/icons/sun.svg')");
  app.events.click();
  assert.equal(app.root.dataset.theme, 'light');
  assert.equal(app.storage.get('cue-theme-v1'), 'light');
  assert.equal(app.attributes['aria-label'], 'Switch to dark theme');
});

test('system changes apply until a theme is explicitly selected', () => {
  const app = setup({systemDark:true});
  assert.equal(app.root.dataset.theme, 'dark');
  app.events.ready();
  app.events.system({matches:false});
  assert.equal(app.root.dataset.theme, 'light');
  app.events.click();
  app.events.system({matches:false});
  assert.equal(app.root.dataset.theme, 'dark');
  const saved = setup({saved:'light',systemDark:true});
  saved.events.system({matches:true});
  assert.equal(saved.root.dataset.theme, 'light');
});

test('blocked storage still allows theme switching', () => {
  const app = setup({blocked:true});
  app.events.ready();
  assert.doesNotThrow(()=>app.events.click());
  assert.equal(app.root.dataset.theme, 'dark');
});
