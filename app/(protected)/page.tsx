import { redirect } from "next/navigation";

// /  is handled by app/page.tsx; this segment is kept only as a route-group
// anchor so the (protected) layout wraps /dashboard and sibling routes.
export default function ProtectedRoot() {
  redirect("/dashboard");
}
