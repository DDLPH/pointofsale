import assert from 'node:assert/strict';
const root='http://localhost:5173';
const headers={Cookie:'__sites_local_auth=1',Origin:root,'Content-Type':'application/json'};
async function call(body,extra={}){const res=await fetch(root+'/api/pos',{method:body?'POST':'GET',headers:{...headers,...extra},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json().catch(()=>({}))};}
assert.equal((await call(null,{Cookie:''})).status,401);
assert.equal((await call({action:'seed'},{Origin:'https://invalid.example'})).status,403);
let state=(await call()).data;
assert.equal(state.products.filter(p=>p.category!=='ทดสอบ').length,10);
const p={id:crypto.randomUUID(),name:'TEST ONLY',price:3500,category:'ทดสอบ',active:1};
assert.equal((await call({action:'product',product:p})).status,200);
const sale={id:crypto.randomUUID(),method:'cash',received:10000,items:[{productId:p.id,price:3500,qty:2,note:'เส้นเล็ก'}]};
assert.equal((await call({action:'sale',sale:{...sale,received:6000}})).status,400);
assert.equal((await call({action:'sale',sale:{...sale,items:[{...sale.items[0],qty:-1}]}})).status,400);
assert.equal((await call({action:'sale',sale:{...sale,items:[{...sale.items[0],price:1}]}})).status,409);
const concurrent=await Promise.all([call({action:'sale',sale}),call({action:'sale',sale})]);
assert.ok(concurrent.every(r=>r.status===200));
state=(await call()).data;assert.equal(state.orders.filter(o=>o.id===sale.id).length,1);
const saved=state.orders.find(o=>o.id===sale.id);assert.equal(saved.total,7000);assert.equal(saved.received-saved.total,3000);
assert.equal((await call({action:'product',product:{...p,price:4500}})).status,200);
assert.equal((await call()).data.orders.find(o=>o.id===sale.id).items[0].price,3500);
assert.equal((await call({action:'cancel',id:sale.id,reason:''})).status,400);
assert.equal((await call({action:'cancel',id:sale.id,reason:'ทดสอบยกเลิก'})).status,200);
assert.ok((await call()).data.orders.find(o=>o.id===sale.id).cancelled);
assert.equal((await call({action:'cancel',id:sale.id,reason:'ซ้ำ'})).status,409);
const transfer={...sale,id:crypto.randomUUID(),method:'transfer',received:0,items:[{...sale.items[0],price:4500,qty:1}]};
assert.equal((await call({action:'sale',sale:transfer})).status,200);
assert.equal((await call()).data.orders.find(o=>o.id===transfer.id).received,4500);
await call({action:'cancel',id:transfer.id,reason:'สิ้นสุดทดสอบ'});
await call({action:'product',product:{...p,price:4500,active:0}});
assert.equal((await call({action:'sale',sale:{...transfer,id:crypto.randomUUID()}})).status,409);
console.log('PASS: authentication, origin, cash, transfer, duplicate concurrent submit, validation, price snapshot, cancellation, inactive product. Local test records retained and cancelled.');


