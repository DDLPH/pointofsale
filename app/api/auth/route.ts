import { z } from 'zod';
import { bootstrap,digest,getStaff,limited,sameOrigin,sessionCookie,verifyPassword,SESSION_COOKIE } from '@/lib/auth';
import { database } from '@/lib/server-db';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200,extra:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...extra}});
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))return json({error:'คำขอไม่ถูกต้อง'},403);
  const data=z.object({action:z.enum(['login','logout']),username:z.string().max(40).optional(),password:z.string().max(128).optional()}).parse(await request.json());
  if(data.action==='logout'){
   const raw=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
   if(raw)await database().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(raw)).run();
   return json({ok:true},200,{'Set-Cookie':sessionCookie(request,'',0)});
  }
  const username=data.username?.trim()||'',password=data.password||'';
  if(!username||!password)return json({error:'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'},400);
  const ip=request.headers.get('cf-connecting-ip')||'shared';
  if(await limited(`ip:${await digest(ip)}`,30)||await limited(`user:${username.toLowerCase()}`,5))return json({error:'ลองเข้าสู่ระบบเกินจำนวนครั้ง กรุณารอ 15 นาที'},429,{'Retry-After':'900'});
  await bootstrap();
  const user=await database().prepare('SELECT id,username,password_hash,role,active FROM staff_users WHERE username=? COLLATE NOCASE').bind(username).first<{id:string;username:string;password_hash:string;role:string;active:number}>();
  // Use the same expensive path for unknown usernames.
  const fallback='pbkdf2:100000:00000000000000000000000000000000:'+ '0'.repeat(64);
  const valid=await verifyPassword(password,user?.password_hash||fallback);
  if(!valid||!user?.active)return json({error:'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'},401);
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
  await database().batch([
   database().prepare('INSERT INTO sessions (token_hash,user_id,expires) VALUES (?,?,?)').bind(await digest(token),user.id,Date.now()+43200000),
   database().prepare('DELETE FROM login_limits WHERE key=?').bind(`user:${username.toLowerCase()}`),
   database().prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()),
  ]);
  return json({ok:true,username:user.username,role:user.role},200,{'Set-Cookie':sessionCookie(request,token)});
 }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'ข้อมูลไม่ถูกต้อง'},400);console.error('Authentication unavailable');return json({error:'เข้าสู่ระบบไม่ได้ชั่วคราว กรุณาลองใหม่'},503);}
}
export async function GET(request:Request){try{const user=await getStaff(request);return user?json({username:user.username,role:user.role}):json({error:'กรุณาเข้าสู่ระบบ'},401);}catch{return json({error:'ระบบไม่พร้อม'},503);}}
