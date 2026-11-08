{
  description = "Bark Surface";

  nixConfig = {
    extra-substituters = [ "https://scottylabs.cachix.org" ];
    extra-trusted-public-keys = [
      "scottylabs.cachix.org-1:hajjEX5SLi/Y7yYloiXTt2IOr3towcTGRhMh1vu6Tjg="
    ];
  };

  inputs = {
    scottylabs.url = "git+https://git.cmu.dev/ScottyLabs/kennel";
    nixpkgs.follows = "scottylabs/nixpkgs";
    flake-parts.follows = "scottylabs/flake-parts";
  };

  outputs =
    inputs:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ inputs.scottylabs.flakeModules.default ];
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      perSystem =
        { helpers, ... }:
        {
          scottylabs = {
            project.name = "cmugpt-surface";
            conventionalCommits.enable = false;

            postgres = {
              enable = true;
              extensions = e: [ e.pgvector ];
            };

            ricochet = {
              enable = true;
              appUrl = "http://localhost:4173";
            };

            deno = {
              enable = true;
              react.enable = true;
            };

            processes = {
              api = {
                run = "cd apps/server && PORT=3001 exec secretspec run -P dev -- deno task dev";
                depends = [ "postgres-setup" ];
              };
              web.run = "cd apps/web && deno task dev";
            };
          };

          # TanStack Router regenerates this on every dev and build run
          treefmt.settings.global.excludes = [ "apps/web/src/routeTree.gen.ts" ];

          sites.web = {
            package = helpers.buildDenoTask {
              src = ./.;
              cwd = "apps/web";
              pname = "cmugpt-surface-web";
            };
            spa = true;
            customDomain = "bark.scottylabs.org";
          };

          services.api = {
            package = helpers.buildDenoTask {
              src = ./.;
              cwd = "apps/server";
              pname = "cmugpt-surface-api";
              entrypoint = "src/server.ts";
              compile = true;
            };
            customDomain = "api.cmugpt.com";
          };
        };
    };
}
