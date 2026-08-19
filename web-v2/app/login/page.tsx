import { Suspense } from "react";
import LoginForm from "./login-form";

/**
 * Board 01.
 *
 * The form reads ?next= to return people to where they were aiming, and
 * useSearchParams suspends during prerender — so the boundary lives here and
 * the form stays a client component underneath it.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-pitch" />}>
      <LoginForm />
    </Suspense>
  );
}
