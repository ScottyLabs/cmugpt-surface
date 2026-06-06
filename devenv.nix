{ pkgs, config, inputs, ... }:
{
  imports = [ inputs.scottylabs.devenvModules.default ];

  scottylabs = {
    enable = true;
    project.name = "chat";

    kennel.services.webapp = {
      oidc.redirectPaths = [ "/auth/callback" ];
    };

    kennel.sites.web = {
      customDomain = "chat.scottylabs.net";
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

