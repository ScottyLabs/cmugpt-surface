{ pkgs, config, inputs, ... }:
{
  imports = [ inputs.scottylabs.devenvModules.default ];

  packages = [
    pkgs.bun
  ];

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
        oidc.redirectPaths = [ "/oauth/callback" ];
      
      };

      # Deploys your frontend React app
      sites.web = {
        spa = true; # Set to true since React apps are typically Single Page Applications
      };
    };
  };


  # Local Development Processes (used when you run `devenv up`)
  processes.server = {
    exec = "bun run --cwd apps/server server";
    ready.http.get = {
      port = 8081;
      path = "/"; # Consider updating to "/health" if you have a specific health check route
    };
  };

  processes.web = {
    exec = "bun run --cwd apps/web dev";
    ready.http.get = {
      port = 3000;
      path = "/";
    };
  };
}
