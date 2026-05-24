import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";

export function Header() {
  const { user } = useUser();

  return (
    <header className="p-4 flex items-center justify-between bg-gray-800 text-white shadow-lg">
      <h1 className="text-xl font-semibold">CMU GPT</h1>

      <div className="flex items-center gap-4">
        <SignedIn>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {user?.primaryEmailAddress?.emailAddress}
            </span>
            <UserButton />
          </div>
        </SignedIn>

        <SignedOut>
          <span className="text-sm text-gray-300">Not signed in</span>
        </SignedOut>
      </div>
    </header>
  );
}
