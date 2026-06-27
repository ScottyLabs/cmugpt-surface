{ pkgs, inputs, ... }:

let
  packages = pkgs.callPackage ./nix/packages.nix { };
in
{
  imports = [ inputs.scottylabs.devenvModules.default ];

  scottylabs = {
    enable = true;
    project.name = "cmugpt-surface";
    secrets.enable = true;
    postgres.enable = true;

    # Kennel deployment configuration
    kennel = {
      # Deploys your backend API
      services.api = {
        # customDomain = "api.cmugpt.scottylabs.org"; # (Optional) Uncomment and change if needed
      };

      # Deploys your frontend React app
      sites.web = {
        spa = true; # Set to true since React apps are typically Single Page Applications
      };
    };
  };

  packages = [ pkgs.bun ];

  outputs = {
    inherit (packages) api web;
  };

  processes = {
    api.exec = "bun run --cwd apps/server dev";
    web.exec = "bun run --cwd apps/web dev";
  };
}
