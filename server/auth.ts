import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Prisma, PrismaClient, User } from './generated/prisma/client.ts';
import { db } from './db.ts';
import { authSecret } from './config.ts';
import { ServiceError } from './errors.ts';
import { sendEmail } from './providers/email.ts';

export const sessionCookie = 'oralia_session';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const keyed = (value: string) => createHmac('sha256', authSecret()).update(value).digest('hex');
export function sessionData(user: User, expiresAt: Date) {
  return { kind: 'verified-email' as const, id: user.id, displayName: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl, expiresAt: expiresAt.toISOString(), preferredVoiceType: user.preferredVoiceType };
}
export function setSessionCookie(response: ServerResponse, token: string, expiresAt: Date) {
  response.setHeader('Set-Cookie', `${sessionCookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}${process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
export function createAuthService(database: PrismaClient, deliver: typeof sendEmail = sendEmail) {
  async function rate(tx: Prisma.TransactionClient, key: string, max: number) {
    const now = new Date();
    await tx.authRateLimit.upsert({ where: { key }, create: { key, count: 0, resetAt: new Date(now.getTime()+3600000) }, update: {} });
    await tx.authRateLimit.updateMany({ where: { key, resetAt: { lte: now } }, data: { count: 0, resetAt: new Date(now.getTime()+3600000) } });
    const updated = await tx.authRateLimit.updateMany({ where: { key, count: { lt: max } }, data: { count: { increment: 1 } } });
    if (!updated.count) throw new ServiceError('RATE_LIMITED', 429, 'Too many attempts. Please try again later.');
  }
  return {
    async requestCode(email: string, ip: string) {
      if (email.endsWith('@collections.oralia.invalid')) throw new ServiceError('RESERVED_ADDRESS', 400, 'Use your own email address.');
      const pin = String(randomInt(0,1000000)).padStart(6,'0');
      const challenge = await database.$transaction(async tx => {
        await rate(tx, keyed('send-email:'+email),5);
        await rate(tx, keyed('send-ip:'+ip),10);
        const recent = await tx.otpChallenge.findFirst({ where: { email, createdAt: { gt: new Date(Date.now()-60000) } } });
        if (recent) throw new ServiceError('RESEND_COOLDOWN', 429, 'Wait sixty seconds before requesting another code.');
        await tx.otpChallenge.updateMany({ where: { email, used:false }, data: { used:true } });
        return tx.otpChallenge.create({ data: { email, codeHash:keyed(email+':'+pin), expiresAt:new Date(Date.now()+600000) } });
      });
      try {
        await deliver(email, 'Your Oralia verification code', `Your Oralia verification code is ${pin}.\n\nIt expires in ten minutes. Do not share this code. If you did not request it, ignore this email.`);
        await database.otpChallenge.update({ where: { id:challenge.id }, data: { sentAt:new Date() } });
      } catch (error) {
        await database.otpChallenge.update({ where:{id:challenge.id},data:{used:true} });
        throw error;
      }
      return { challengeId:challenge.id, expiresAt:challenge.expiresAt.toISOString() };
    },
    async verify(challengeId: string, pin: string, ip: string) {
      // Failed attempts must commit their counters, so validation failures are returned from the transaction.
      const result = await database.$transaction(async tx => {
        await rate(tx,keyed('verify-ip:'+ip),30);
        const challenge = await tx.otpChallenge.findUnique({where:{id:challengeId}});
        if (!challenge || challenge.used || !challenge.sentAt || challenge.expiresAt.getTime()<=Date.now() || challenge.attempts>=5) return null;
        const attempted=await tx.otpChallenge.updateMany({where:{id:challengeId,used:false,attempts:{lt:5}},data:{attempts:{increment:1}}});
        if(!attempted.count)return null;
        const expected=Buffer.from(challenge.codeHash,'hex');const candidate=Buffer.from(keyed(challenge.email+':'+pin),'hex');
        if(expected.length!==candidate.length || !timingSafeEqual(expected,candidate))return null;
        const consumed=await tx.otpChallenge.updateMany({where:{id:challengeId,used:false},data:{used:true}});
        if(!consumed.count)return null;
        const prefix=challenge.email.split('@')[0].replace(/[^a-z0-9_]/g,'').slice(0,18)||'creator';
        const user=await tx.user.upsert({where:{email:challenge.email},create:{email:challenge.email,name:prefix,username:prefix+'_'+randomBytes(4).toString('hex'),avatarUrl:'/favicon.svg',bio:'Creator on Oralia.',role:'CREATOR',emailVerifiedAt:new Date()},update:{emailVerifiedAt:new Date(),role:'CREATOR'}});
        const token=randomBytes(32).toString('hex');const expiresAt=new Date(Date.now()+7*86400000);
        await tx.session.create({data:{id:digest(token),userId:user.id,expiresAt,verified:true}});
        return {user,token,expiresAt};
      });
      if(!result)throw new ServiceError('CODE_INVALID',400,'The code is incorrect, expired, or already used.');
      return result;
    },
    async authorize(request: IncomingMessage) {
      const token=request.headers.cookie?.split(';').map(part=>part.trim()).find(part=>part.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
      const session=token&&/^[a-f0-9]{64}$/.test(token)?await database.session.findUnique({where:{id:digest(token)},include:{user:true}}):null;
      if(!session||!session.verified||!session.user.emailVerifiedAt||session.expiresAt.getTime()<=Date.now())throw new ServiceError('UNAUTHENTICATED',401,'Sign in to continue.');
      return session;
    },
  };
}
export const auth = createAuthService(db);
