import Pos from './pos';
import { getChatGPTUser, chatGPTSignInPath } from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();if(!user)return <main className="signin"><div className="brand-mark">ไก่</div><h1>ก๋วยเตี๋ยวไก่มะระ</h1><p>เข้าสู่ระบบเพื่อเปิดร้านและดูยอดขายของคุณ</p><a className="signin-link" href={chatGPTSignInPath('/')} target="_top">เข้าสู่ระบบด้วย ChatGPT</a></main>;return <Pos userKey={user.userId}/>;}

