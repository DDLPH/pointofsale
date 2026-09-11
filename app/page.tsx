import Pos from './pos';
import Login from './login';
import { getStaff } from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getStaff();return user?<Pos userKey={user.id} role={user.role} username={user.username}/>:<Login/>;}
