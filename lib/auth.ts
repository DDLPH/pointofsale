import { headers } from 'next/headers';
import { env } from 'cloudflare:workers';
import { database } from './server-db';
import { menuSeed } from './pos';

export const SHOP_ID = 'main-shop';
export const SESSION_COOKIE = 'pos_session';
export type Staff = { id:string; username:string; role:'admin'|'staff'; active:number };
const encoder = new TextEncoder();
const hex = (bytes:ArrayBuffer) => Array.from(new Uint8Array(bytes), n=>n.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
export async function hashPassword(password:string,salt=hex(crypto.getRandomValues(new Uint8Array(16)).buffer)){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const hash=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
  return `pbkdf2:100000:${salt}:${hash}`;
}
export async function verifyPassword(password:string,stored:string){
  const parts=stored.split(':');if(parts.length!==4||parts[0]!=='pbkdf2'||parts[1]!=='100000')return false;
  const candidate=await hashPassword(password,parts[2]);let diff=candidate.length^stored.length;
  for(let i=0;i<candidate.length;i++)diff|=candidate.charCodeAt(i)^(stored.charCodeAt(i)||0);
  return diff===0;
}
export async function bootstrap(){
  if(!env.POS_BOOTSTRAP_USERS)throw new Error('Missing account setup');
  const rows=JSON.parse(env.POS_BOOTSTRAP_USERS) as {username:string;role:string;hash:string}[];
  if(rows.length!==2||rows.some(r=>!['admin','staff'].includes(r.role)||!r.hash.startsWith('pbkdf2:100000:')))throw new Error('Invalid account setup');
  const db=database();
  await db.batch(rows.map(r=>db.prepare('INSERT INTO staff_users (id,username,password_hash,role,active) VALUES (?,?,?,?,1) ON CONFLICT(username) DO NOTHING').bind(`initial-${r.username}`,r.username,r.hash,r.role)));
  // Shared shop menu, seeded once by deterministic IDs; no schema writes at runtime.
  await db.batch(menuSeed.map(p=>db.prepare('INSERT INTO products (id,owner,name,price,category,active) VALUES (?,?,?,?,?,1) ON CONFLICT(id) DO NOTHING').bind(p.id,SHOP_ID,p.name,p.price,p.category)));
}
export async function getStaff(request?:Request):Promise<Staff|null>{
 const h=request?.headers??await headers();const token=(h.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 return database().prepare('SELECT u.id,u.username,u.role,u.active FROM sessions s JOIN staff_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1').bind(await digest(token),Date.now()).first<Staff>();
}
export function sameOrigin(request:Request){return request.headers.get('origin')===new URL(request.url).origin;}
export function sessionCookie(request:Request,token:string,maxAge=43200){return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function limited(key:string,limit:number,window=900000){
 const start=Math.floor(Date.now()/window)*window;
 const row=await database().prepare('INSERT INTO login_limits (key,window_start,attempts) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_start=excluded.window_start THEN attempts+1 ELSE 1 END,window_start=excluded.window_start RETURNING attempts').bind(key,start).first<{attempts:number}>();
 return !row||row.attempts>limit;
}
