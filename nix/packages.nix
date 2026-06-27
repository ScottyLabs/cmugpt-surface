{ lib, scottylabs, pkgs }:

let
  src = lib.cleanSourceWith {
    src = ../.;
    filter = path: type:
      let base = baseNameOf path;
      in !(builtins.elem base [
        ".devenv"
        ".direnv"
        ".env"
        "node_modules"
        "dist"
        "build"
        "result"
        ".git"
      ]);
  };
in
{
  api = pkgs.stdenv.mkDerivation {
    pname = "api";
    version = "0.0.0";
    inherit src;
    nativeBuildInputs = [ pkgs.bun pkgs.makeWrapper ];
    buildPhase = ''
      export HOME=$TMPDIR
      bun install --frozen-lockfile --ignore-scripts
      bun run --cwd apps/server build
    '';
    installPhase = ''
      mkdir -p $out/share/cmugpt-surface/api
      cp -r apps/server/dist $out/share/cmugpt-surface/api/
      [ -d apps/server/build ] && cp -r apps/server/build $out/share/cmugpt-surface/api/ || true
      [ -d apps/server/drizzle ] && cp -r apps/server/drizzle $out/share/cmugpt-surface/api/ || true
      makeWrapper ${pkgs.bun}/bin/bun $out/bin/cmugpt-surface-api \
        --chdir $out/share/cmugpt-surface/api \
        --add-flags "dist/server.js"
    '';
  };

  web = pkgs.stdenv.mkDerivation {
    pname = "web";
    version = "0.0.0";
    inherit src;
    nativeBuildInputs = [ pkgs.bun ];
    buildPhase = ''
      export HOME=$TMPDIR
      bun install --frozen-lockfile --ignore-scripts
      export VITE_SERVER_URL="https://cmugpt-surface-api-main.scottylabs.net"
      export VITE_OIDC_ISSUER_URL="https://idp.scottylabs.org/realms/scottylabs"
      export VITE_OIDC_CLIENT_ID="sl-ai-prod"
      export VITE_OIDC_REDIRECT_URI="https://cmugpt-surface-web-main.scottylabs.net/auth/callback"
      export VITE_OIDC_POST_LOGOUT_REDIRECT_URI="https://cmugpt-surface-web-main.scottylabs.net/auth/callback"
      bun run --cwd apps/web build
    '';
    installPhase = ''
      mkdir -p $out
      cp -r apps/web/dist/* $out/
    '';
  };
}
