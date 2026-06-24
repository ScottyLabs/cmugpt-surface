{ pkgs, inputs, ... }:
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
      services.server = {
        # customDomain = "api.cmugpt.scottylabs.org"; # (Optional) Uncomment and change if needed
      };

      # Deploys your frontend React app
      sites.web = {
        spa = true; # Set to true since React apps are typically Single Page Applications
      };
    };
  };

  processes = {
    api.exec = "bun run --cwd apps/server dev";
    web.exec = "bun run --cwd apps/web dev";
  };
}
