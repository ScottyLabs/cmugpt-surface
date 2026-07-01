import { useAuth } from "react-oidc-context";

export function Header() {
  const auth = useAuth();
  const profile = auth.user?.profile;
  const label = profile?.email ?? profile?.preferred_username ?? profile?.name ?? profile?.sub;

  return (
    <header className="p-4 flex items-center justify-between bg-gray-800 text-white shadow-lg">
      <h1 className="text-xl font-semibold">CMU GPT</h1>

      <div className="flex items-center gap-4">
        {auth.isAuthenticated ? (
          <div className="flex items-center gap-3">
            <span className="text-sm">{label ?? "Signed in"}</span>
            <button
              type="button"
              onClick={() => void auth.signoutRedirect()}
              className="rounded bg-white/10 px-3 py-1 text-xs font-medium hover:bg-white/20"
            >
              Sign out
            </button>
          </div>
        ) : (
          <span className="text-sm text-gray-300">Not signed in</span>
        )}
      </div>
    </header>
  );
}
