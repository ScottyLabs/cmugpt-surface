{
  description = "CMUGPT Surface";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs, ... }:
    let
      inherit (nixpkgs) lib;
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      forAllSystems = lib.genAttrs supportedSystems;
      pkgsFor = system: nixpkgs.legacyPackages.${system};

      # 1. Fixed-Output Derivation to cache ALL package contents cleanly without symlinks
      mkBunStore = pkgs: pkgs.stdenv.mkDerivation {
        pname = "cmugpt-surface-store";
        version = "0.0.0";
        src = ./.;

        nativeBuildInputs = [ pkgs.bun ];

        buildPhase = ''
          export HOME=$TMPDIR
          bun install --frozen-lockfile
        '';

        installPhase = ''
          mkdir -p $out
          if [ -d ~/.bun/install/cache ]; then
            cp -r ~/.bun/install/cache/* $out/
          fi
          
          # CRITICAL: Find and delete all internal symlinks inside the cache folder
          # Bun doesn't actually need these symlinks to run an offline installation;
          # it just needs the flat physical tarball objects.
          find $out -type l -delete
        '';

        outputHashAlgo = "sha256";
        outputHashMode = "recursive";
        outputHash = "sha256-7EeAKl8XB24jWsVyXCK3/otxTGhjbcrFRYcgCw9hcO4=";
      };

      # 2. Server Compilation
      mkServer = pkgs: bunStore:
        pkgs.stdenv.mkDerivation {
          pname = "cmugpt-surface-server";
          version = "0.0.0";
          src = ./.;

          nativeBuildInputs = [ pkgs.bun pkgs.makeWrapper ];

          buildPhase = ''
            runHook preBuild
            
            export HOME=$TMPDIR
            mkdir -p ~/.bun/install/cache
            
            # Feed the offline tarballs back into Bun's sandbox profile
            cp -r ${bunStore}/* ~/.bun/install/cache/

            # Tell Bun to handle the workspace creation completely offline
            bun install --frozen-lockfile --offline

            bun run --cwd apps/server build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out/share/cmugpt-surface/server
            cp -r apps/server/dist $out/share/cmugpt-surface/server/
            
            if [ -d apps/server/build ]; then cp -r apps/server/build $out/share/cmugpt-surface/server/; fi
            if [ -d apps/server/drizzle ]; then cp -r apps/server/drizzle $out/share/cmugpt-surface/server/; fi
            
            makeWrapper ${pkgs.bun}/bin/bun $out/bin/cmugpt-surface-server \
              --chdir $out/share/cmugpt-surface/server \
              --add-flags "dist/server.js"
            runHook postInstall
          '';
        };

      # 3. Static Web Client compilation
      mkWeb = pkgs: bunStore:
        pkgs.stdenv.mkDerivation {
          pname = "cmugpt-surface-web";
          version = "0.0.0";
          src = ./.;

          nativeBuildInputs = [ pkgs.bun ];

          buildPhase = ''
            runHook preBuild
            
            export HOME=$TMPDIR
            mkdir -p ~/.bun/install/cache
            cp -r ${bunStore}/* ~/.bun/install/cache/
            
            bun install --frozen-lockfile --offline

            export VITE_SERVER_URL="https://cmugpt-surface-server-main.scottylabs.net"
            export VITE_OIDC_ISSUER_URL="https://idp.scottylabs.org/realms/scottylabs"
            export VITE_OIDC_CLIENT_ID="cmugpt-surface"
            export VITE_OIDC_REDIRECT_URI="https://cmugpt-surface-web-main.scottylabs.net/auth/callback"
            
            bun run --cwd apps/web build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out
            cp -r apps/web/dist/* $out/
            runHook postInstall
          '';
        };
    in
    {
      overlays.default = final: prev:
        let bunStore = mkBunStore final;
        in {
          api = mkServer final bunStore;
          web = mkWeb final bunStore;
        };

      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          bunStore = mkBunStore pkgs;
        in
        {
          api = mkServer pkgs bunStore;
          web = mkWeb pkgs bunStore;
          default = mkServer pkgs bunStore;
        }
      );
    };
}
