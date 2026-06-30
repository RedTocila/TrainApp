export function isNavRouteMatch(pathname: string, href: string, exact = false) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/admin") return pathname === "/admin";
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
