import test from 'node:test';import assert from 'node:assert/strict';const m=await import('../src/worker.js').catch(()=>({}));
const req=(path,body)=>new Request('https://example.org'+path,{method:body?'POST':'GET',...(body?{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}:{})});
test('health reports missing configuration honestly',async()=>{assert.ok(m.default);const r=await m.default.fetch(req('/api/health'),{});assert.equal(r.status,503);});
test('invalid searches fail before database calls',async()=>{assert.ok(m.default);assert.equal((await m.default.fetch(req('/api/search',{query:''}),{})).status,400);});
test('admin writes require authentication',async()=>{assert.ok(m.default);assert.equal((await m.default.fetch(req('/api/records',{title:'x'}),{})).status,401);});
test('oversized bodies return a client error',async()=>{assert.ok(m.default);assert.equal((await m.default.fetch(req('/api/search',{query:'x'.repeat(70000)}),{})).status,413);});
