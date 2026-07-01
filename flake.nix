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

          web = (helpers.buildDenoTask {
            pname = "cmugpt-surface-web";
            src = ./apps/web;
            task = "build";
          }).overrideAttrs (_old: {
            VITE_SERVER_URL = "https://cmugpt-surface-api-main.scottylabs.net";
            VITE_OIDC_ISSUER_URL = "https://idp.scottylabs.org/realms/scottylabs";
            VITE_OIDC_CLIENT_ID = "sl-ai-prod";
            VITE_OIDC_REDIRECT_URI = "https://cmugpt-surface-web-main.scottylabs.net/auth/callback";
            VITE_OIDC_POST_LOGOUT_REDIRECT_URI = "https://cmugpt-surface-web-main.scottylabs.net/auth/callback";
          });

          api = (helpers.buildDenoTask {
            pname = "cmugpt-surface-api";
            src = ./apps/server;
            task = "build";
            entrypoint = "src/server.ts";
            compile = true;
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
