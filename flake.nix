{
  description = "CMUGPT Surface";

  nixConfig = {
    extra-substituters = [ "https://scottylabs.cachix.org" ];
    extra-trusted-public-keys = [
      "scottylabs.cachix.org-1:hajjEX5SLi/Y7yYloiXTt2IOr3towcTGRhMh1vu6Tjg="
    ];
  };

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    devenv.url = "github:cachix/devenv";
    scottylabs = {
      url = "git+https://codeberg.org/ScottyLabs/devenv";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, devenv, scottylabs, ... }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          helpers = scottylabs.mkLib pkgs;

          # Local override: upstream helpers.buildDenoTask extracts npm tarballs
          # with `tar -x` and chokes on packages shipping read-only directories.
          # ./nix/build-deno-task.nix is a verbatim copy + --delay-directory-restore.
          # TODO: remove once fixed upstream in ScottyLabs/devenv.
          buildDenoTask = pkgs.callPackage ./nix/build-deno-task.nix { };

          web = (buildDenoTask {
            pname = "cmugpt-surface-web";
            src = ./apps/web;
          }).overrideAttrs (_old: {
            VITE_SERVER_URL = "https://cmugpt-surface-api-main.scottylabs.net";
            VITE_OIDC_ISSUER_URL = "https://idp.scottylabs.org/realms/scottylabs";
            VITE_OIDC_CLIENT_ID = "sl-ai-prod";
            VITE_OIDC_REDIRECT_URI = "https://cmugpt-surface-web-main.scottylabs.net/auth/callback";
            VITE_OIDC_POST_LOGOUT_REDIRECT_URI = "https://cmugpt-surface-web-main.scottylabs.net/auth/callback";
          });

          api = (buildDenoTask {
            pname = "cmugpt-surface-api";
            src = ./apps/server;
            entrypoint = "src/server.ts";
            compile = true;
            sloppyImports = true;
          }).overrideAttrs (old: {
            nativeBuildInputs = (old.nativeBuildInputs or [ ]) ++ [ pkgs.makeWrapper ];
            postInstall = ''
              wrapProgram $out/bin/cmugpt-surface-api --set STATIC_DIR ${web}
            '';
          });
        in
        {
          inherit web api;
          default = api;
          devenv = devenv.packages.${system}.devenv;
        }
      );
    };
}
