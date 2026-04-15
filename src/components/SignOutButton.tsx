"use client";

import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function SignOutButton() {
  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-xs px-2 py-1 rounded-md transition-all"
      style={{
        color: "var(--text-dim)",
        border: "1px solid var(--border)",
      }}
    >
      Sign out
    </button>
  );
}
