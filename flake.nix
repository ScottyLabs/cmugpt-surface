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

      mkWorkspaceInstall = ''
        export HOME=$TMPDIR
        export BUN_INSTALL=$TMPDIR/bun
        export BUN_CACHE_DIR=$TMPDIR/bun-cache
        bun install --frozen-lockfile
      '';

      mkServer = pkgs:
        pkgs.stdenv.mkDerivation {
          pname = "cmugpt-surface-server";
          version = "0.0.0";
          src = ./.;

          nativeBuildInputs = [ pkgs.bun pkgs.makeWrapper ];

          buildPhase = ''
            runHook preBuild
            ${mkWorkspaceInstall}
            bun run --cwd apps/server build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out/share/cmugpt-surface/server
            cp -r apps/server/dist $out/share/cmugpt-surface/server/
            cp -r apps/server/build $out/share/cmugpt-surface/server/
            cp -r apps/server/drizzle $out/share/cmugpt-surface/server/
            makeWrapper ${pkgs.bun}/bin/bun $out/bin/cmugpt-surface-server \
              --chdir $out/share/cmugpt-surface/server \
              --add-flags "dist/server.js"
            runHook postInstall
          '';
        };

      mkWeb = pkgs:
        pkgs.stdenv.mkDerivation {
          pname = "cmugpt-surface-web";
          version = "0.0.0";
          src = ./.;

          nativeBuildInputs = [ pkgs.bun ];

          buildPhase = ''
            runHook preBuild
            ${mkWorkspaceInstall}
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
      overlays.default = final: prev: {
        server = mkServer final;
        webapp = mkServer final;
        web = mkWeb final;
      };

      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          server = mkServer pkgs;
          webapp = mkServer pkgs;
          web = mkWeb pkgs;
          default = mkServer pkgs;
        }
      );
    };
}
