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
    scottylabs = {
      url = "git+https://codeberg.org/ScottyLabs/devenv";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {

      nixpkgs,
      ...
    }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};

          # Local override: upstream helpers.buildDenoTask extracts npm tarballs
          # with `tar -x` and chokes on packages shipping read-only directories.
          # ./nix/build-deno-task.nix is a verbatim copy + --delay-directory-restore.
          # TODO: remove once fixed upstream in ScottyLabs/devenv.
          buildDenoTask = pkgs.callPackage ./nix/build-deno-task.nix { };

          web = buildDenoTask {
            pname = "cmugpt-surface-web";
            src = ./apps/web;
            # web's lock references the sibling `@cmugpt-frontend/server` (imported for
            # types only via ../server/build/openapi.d.ts), which isn't in this src, so the
            # lock can't be re-derived in isolation. Still offline/pinned via --cached-only.
            frozen = false;
            env.VITE_API_URL = "https://api.cmugpt.com";
          };

          api = buildDenoTask {
            pname = "cmugpt-surface-api";
            src = ./apps/server;
            entrypoint = "src/server.ts";
            compile = true;
            sloppyImports = true;
          };
        in
        {
          inherit web api;
        }
      );
    };
}
