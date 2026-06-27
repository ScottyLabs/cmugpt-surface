{ lib, stdenv, bun, makeWrapper }:

let
  # Clean source to exclude build artifacts
  cleanSrc = lib.cleanSourceWith {
    src = ../.;
    filter = path: type:
      let base = baseNameOf path;
      in !(builtins.elem base [
        ".devenv" ".direnv" ".env" "node_modules" "dist" "build" "result" ".git"
      ]);
  };

  # FOD for Bun deps cache, drops symlinks that break Nix store
  bunStore = stdenv.mkDerivation {
    pname = "cmugpt-surface-deps";
    version = "0.0.0";
    src = cleanSrc;
    nativeBuildInputs = [ bun ];
    buildPhase = ''
      export HOME=$TMPDIR
      bun install --frozen-lockfile --ignore-scripts
    '';
    installPhase = ''
      mkdir -p $out
      if [ -d ~/.bun/install/cache ]; then
        cp -r ~/.bun/install/cache/* $out/
      fi
      find $out -type l -delete
    '';
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-7EeAKl8XB24jWsVyXCK3/otxTGhjbcrFRYcgCw9hcO4=";
  };

  mkBunApp = { pname, buildPath, installPath ? "dist", binName, binScript }:
    stdenv.mkDerivation {
      inherit pname;
      version = "0.0.0";
      src = cleanSrc;
      nativeBuildInputs = [ bun makeWrapper ];
      buildPhase = ''
        export HOME=$TMPDIR
        mkdir -p ~/.bun/install/cache
        cp -r ${bunStore}/* ~/.bun/install/cache/
        bun install --frozen-lockfile --offline --ignore-scripts
        bun run --cwd ${buildPath} build
      '';
      installPhase = ''
        mkdir -p $out/share/cmugpt-surface/${pname}
        cp -r ${buildPath}/${installPath} $out/share/cmugpt-surface/${pname}/
        [ -d ${buildPath}/build ] && cp -r ${buildPath}/build $out/share/cmugpt-surface/${pname}/ || true
        [ -d ${buildPath}/drizzle ] && cp -r ${buildPath}/drizzle $out/share/cmugpt-surface/${pname}/ || true
        makeWrapper ${bun}/bin/bun $out/bin/${binName} \
          --chdir $out/share/cmugpt-surface/${pname} \
          --add-flags "${binScript}"
      '';
    };
in
{
  api = mkBunApp {
    pname = "api";
    buildPath = "apps/server";
    binName = "cmugpt-surface-api";
    binScript = "dist/server.js";
  };

  web = stdenv.mkDerivation {
    pname = "cmugpt-surface-web";
    version = "0.0.0";
    src = cleanSrc;
    nativeBuildInputs = [ bun ];
    buildPhase = ''
      export HOME=$TMPDIR
      mkdir -p ~/.bun/install/cache
      cp -r ${bunStore}/* ~/.bun/install/cache/
      bun install --frozen-lockfile --offline --ignore-scripts
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
