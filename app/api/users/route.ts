import {z} from 'zod';
import {getStaff,hashPassword,sameOrigin} from '@/lib/auth';
import {database} from '@/lib/server-db';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){try{const user=await getStaff(request);if(user?.role!=='admin')return json({error:'สำหรับแอดมินเท่านั้น'},403);return json({users:(await database().prepare('SELECT id,username,role,active FROM staff_users ORDER BY role,username').all()).results});}catch{return json({error:'โหลดบัญชีไม่ได้'},503);}}
export async function POST(request:Request){try{
 if(!sameOrigin(request))return json({error:'คำขอไม่ถูกต้อง'},403);const user=await getStaff(request);if(user?.role!=='admin')return json({error:'สำหรับแอดมินเท่านั้น'},403);
 const body=z.discriminatedUnion('action',[
  z.object({action:z.literal('create'),username:z.string().trim().regex(/^[A-Za-z0-9_-]{2,40}$/),password:z.string().min(4).max(128)}),
  z.object({action:z.literal('disable'),id:z.string().min(1)}),
  z.object({action:z.literal('password'),id:z.string().min(1),password:z.string().min(4).max(128)}),
 ]).parse(await request.json());const db=database();
 if(body.action==='create'){const existing=await db.prepare('SELECT id FROM staff_users WHERE username=? COLLATE NOCASE').bind(body.username).first();if(existing)return json({error:'ชื่อผู้ใช้นี้มีแล้ว'},409);await db.prepare('INSERT INTO staff_users (id,username,password_hash,role,active) VALUES (?,?,?,\'staff\',1)').bind(crypto.randomUUID(),body.username,await hashPassword(body.password)).run();}
 else {const target=await db.prepare('SELECT id,role FROM staff_users WHERE id=?').bind(body.id).first<{id:string;role:string}>();if(!target)return json({error:'ไม่พบบัญชี'},404);if(body.action==='disable'){if(target.role==='admin')return json({error:'ไม่สามารถปิดบัญชีแอดมิน'},400);await db.batch([db.prepare('UPDATE staff_users SET active=0 WHERE id=?').bind(body.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(body.id)]);}else await db.batch([db.prepare('UPDATE staff_users SET password_hash=? WHERE id=?').bind(await hashPassword(body.password),body.id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(body.id)]);}
 return json({ok:true});
 }catch(e){if(e instanceof z.ZodError)return json({error:'ชื่อผู้ใช้ใช้ตัวอักษรอังกฤษ ตัวเลข - _ และรหัสผ่านอย่างน้อย 4 ตัว'},400);return json({error:'บันทึกบัญชีไม่ได้'},503);}}
