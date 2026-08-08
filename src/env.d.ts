/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Set by src/middleware.ts for authenticated /admin + /api/admin requests. */
    profile?: import('./lib/auth/session').SessionProfile | null;
    /** True when a staff preview cookie is active (drafts visible). */
    preview?: boolean;
  }
}
