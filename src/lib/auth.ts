import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        await prisma.auditLog.create({
          data: { userId: user.id, accion: "LOGIN", detalle: `Ingreso de ${user.username}` },
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
    // desbloquear un departamento dura lo que dure la sesión (8h), y no se
    // puede falsear desde el cliente porque el JWT está firmado por NextAuth.
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as any).id;
        token.username = (user as any).username;
        token.isSuperAdmin = (user as any).isSuperAdmin;
        token.deptAdminIds = [];
      }
      if (trigger === "update" && session?.deptAdminId) {
        const current: string[] = (token.deptAdminIds as string[]) || [];
        if (!current.includes(session.deptAdminId)) {
          token.deptAdminIds = [...current, session.deptAdminId];
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
