export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/dashboard/:path*", "/departamentos/:path*", "/superadmin/:path*"],
};
