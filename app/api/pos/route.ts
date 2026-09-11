import { getStaff, SHOP_ID } from '@/lib/auth';
import { database } from '@/lib/server-db';
import { z } from 'zod';
import {menuSeed, type Product, type Line} from '@/lib/pos';
export const dynamic = 'force-dynamic';
const productInput=z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(100),price:z.number().int().min(1).max(10000000),category:z.string().trim().min(1).max(30),active:z.number().int().min(0).max(1)});
const saleInput=z.object({id:z.string().uuid(),method:z.enum(['cash','transfer']),received:z.number().int().min(0).max(100000000),items:z.array(z.object({productId:z.string().uuid(),price:z.number().int().positive(),qty:z.number().int().min(1).max(999),note:z.string().trim().max(150)})).min(1).max(100)});
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){
 try { const user=await getStaff();if(!user)return json({error:'กรุณาเข้าสู่ระบบ'},401);const db=database();
 const [p,o]=await Promise.all([db.prepare('SELECT id,name,price,category,active FROM products WHERE owner = ? ORDER BY category,name').bind(SHOP_ID).all(),db.prepare('SELECT id,created,total,method,received,items,cancelled,reason FROM orders WHERE owner = ? ORDER BY created DESC').bind(SHOP_ID).all()]);
 return json({products:p.results,orders:o.results.map(r=>({...r,items:JSON.parse(r.items as string)}))});
 }catch(e){console.error('POS read',e);return json({error:'โหลดข้อมูลไม่ได้ กรุณาลองใหม่'},503);}
}
export async function POST(request:Request){
 try { const user=await getStaff();if(!user)return json({error:'กรุณาเข้าสู่ระบบ'},401);
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return json({error:'คำขอไม่ถูกต้อง'},403);
 const db=database(),owner=SHOP_ID;const body=z.object({action:z.string()}).passthrough().parse(await request.json());
 if(body.action==='seed'){if(user.role!=='admin')return json({error:'สำหรับแอดมินเท่านั้น'},403);const existing=await db.prepare('SELECT id FROM products WHERE owner = ? LIMIT 1').bind(owner).first();if(existing)return json({ok:true});await db.batch(menuSeed.map(p=>db.prepare('INSERT INTO products (id,owner,name,price,category,active) SELECT ?,?,?,?,?,1 WHERE NOT EXISTS (SELECT 1 FROM products WHERE owner = ? AND name = ?)').bind(crypto.randomUUID(),owner,p.name,p.price,p.category,owner,p.name)));return json({ok:true});}
 if(body.action==='product'){if(user.role!=='admin')return json({error:'สำหรับแอดมินเท่านั้น'},403); const p=productInput.parse(body.product); await db.prepare('INSERT INTO products (id,owner,name,price,category,active) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,price=excluded.price,category=excluded.category,active=excluded.active WHERE products.owner=excluded.owner').bind(p.id,owner,p.name,p.price,p.category,p.active).run();return json({ok:true}); }
 if(body.action==='sale'){
 const s=saleInput.parse(body.sale);const existing=await db.prepare('SELECT id,owner FROM orders WHERE id = ?').bind(s.id).first();if(existing){if(existing.owner!==owner)return json({error:'เลขบิลซ้ำ'},409);return json({ok:true,id:s.id});}
 const result=await db.prepare('SELECT id,name,price,category,active FROM products WHERE owner = ?').bind(owner).all<Product>();const map=new Map(result.results.map(p=>[p.id,p]));const items:Line[]=[];
 for(const line of s.items){const p=map.get(line.productId);if(!p||!p.active)return json({error:'มีสินค้าปิดขาย กรุณาโหลดเมนูใหม่'},409);if(p.price!==line.price)return json({error:'ราคาสินค้าเปลี่ยน กรุณาสร้างบิลใหม่ด้วยราคาปัจจุบัน'},409);items.push({...line,name:p.name,price:p.price});}
 const total=items.reduce((n,l)=>n+l.price*l.qty,0);if(!Number.isSafeInteger(total)||total>100000000)return json({error:'ยอดบิลสูงเกินขอบเขต'},400);if(s.method==='cash'&&s.received<total)return json({error:'เงินสดที่รับไม่ครบยอด'},400);
 await db.prepare('INSERT INTO orders (id,owner,created,total,method,received,items) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(s.id,owner,new Date().toISOString(),total,s.method,s.method==='transfer'?total:s.received,JSON.stringify(items)).run();return json({ok:true,id:s.id});
 }
 if(body.action==='cancel'){const p=z.object({id:z.string().uuid(),reason:z.string().trim().min(1).max(200)}).parse(body);const result=await db.prepare('UPDATE orders SET cancelled = ?, reason = ? WHERE id = ? AND owner = ? AND cancelled IS NULL').bind(new Date().toISOString(),p.reason,p.id,owner).run();if(!result.meta.changes)return json({error:'ไม่พบบิลที่ยกเลิกได้'},409);return json({ok:true});}
 return json({error:'ไม่พบคำสั่ง'},400);
 }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'},400);console.error('POS write',e);return json({error:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง บิลเดิมจะไม่ถูกบันทึกซ้ำ'},503);}
}


