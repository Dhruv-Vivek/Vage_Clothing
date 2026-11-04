import { userRoute } from '@/lib/api';
import { loadCart } from '@/lib/cart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = userRoute(async ({ user }) => loadCart(user.id));
