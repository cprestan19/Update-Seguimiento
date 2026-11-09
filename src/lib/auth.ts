import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { verifyDeptUnlockToken } from "@/lib/deptUnlockToken";
import { LOGIN_LIMIT, clientIpFromHeaders, hitAttempt, peekAttempts, resetAttempts } from "@/lib/rateLimit";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8 horas
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;
        if (credentials.username.length > 100 || credentials.password.length > 200) return null;

        const username = credentials.username.trim();
        const ip = clientIpFromHeaders(req?.headers as Record<string, unknown> | undefined);
        const userKey = `login:user:${username.toLowerCase()}`;
        const ipKey = `login:ip:${ip}`;

        // Bloqueo por fuerza bruta: se consulta ANTES de comparar la contraseña.
        const [byUser, byIp] = await Promise.all([
          peekAttempts(userKey, LOGIN_LIMIT.perUser),
          peekAttempts(ipKey, LOGIN_LIMIT.perIp),
        ]);
        if (!byUser.allowed || !byIp.allowed) {
          await prisma.auditLog.create({
            data: { accion: "LOGIN_BLOQUEADO", detalle: JSON.stringify({ username, ip }) },
          });
          return null;
        }

        const user = await prisma.user.findUnique({ where: { username } });
        const valid = user && user.active ? await bcrypt.compare(credentials.password, user.passwordHash) : false;

        if (!user || !user.active || !valid) {
          await Promise.all([
            hitAttempt(userKey, LOGIN_LIMIT.windowSec),
            hitAttempt(ipKey, LOGIN_LIMIT.windowSec),
          ]);
          await prisma.auditLog.create({
            data: {
              userId: user?.id ?? null,
              accion: "LOGIN_FALLIDO",
              detalle: JSON.stringify({ username, ip }),
            },
          });
          return null;
        }

        await resetAttempts(userKey);
        await prisma.auditLog.create({
          data: { userId: user.id, accion: "LOGIN", detalle: JSON.stringify({ username: user.username, ip }) },
        });

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          isSuperAdmin: user.isSuperAdmin,
        } as any;
      },
    }),
  ],
  callbacks: {
    // deptAdminIds vive solo en el JWT firmado (nunca en la base de datos):
    // desbloquear un departamento dura lo que dure la sesión (8h).
    //
    // IMPORTANTE: el contenido de `session` en trigger === "update" lo envía
    // el navegador (useSession().update) y NO es confiable. Solo se acepta un
    // comprobante firmado por el servidor tras validar la contraseña del
    // departamento — ver src/lib/deptUnlockToken.ts.
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as any).id;
        token.username = (user as any).username;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.deptAdminIds = [];
      }
      if (trigger === "update" && session?.deptUnlockToken && token.id) {
        const departmentId = verifyDeptUnlockToken(session.deptUnlockToken, token.id as string);
        if (departmentId) {
          const current: string[] = (token.deptAdminIds as string[]) || [];
          if (!current.includes(departmentId)) {
            token.deptAdminIds = [...current, departmentId];
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).isSuperAdmin = Boolean(token.isSuperAdmin);
        (session.user as any).deptAdminIds = (token.deptAdminIds as string[]) || [];
      }
      return session;
    },
  },
};
