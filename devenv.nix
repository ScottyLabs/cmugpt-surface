{ pkgs, config, inputs, ... }:
{
  imports = [ inputs.scottylabs.devenvModules.default ];

  scottylabs = {
    enable = true;
    project.name = "cmugpt-surface";

    kennel.services.webapp = {
      oidc.redirectPaths = [ "/auth/callback" ];
    };

    kennel.sites.web = {
      customDomain = "cmugpt-surface.scottylabs.org";
      spa = true;
    };

    postgres.enable = true;
  };

  packages = [ pkgs.bun ];

  processes.server = {
    exec = "bun run --cwd apps/server server";
    ready.http.get = {
      port = 8081;
      path = "/";
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

