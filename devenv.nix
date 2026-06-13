{ pkgs, inputs, ... }:
{
  imports = [ inputs.scottylabs.devenvModules.default ];

  scottylabs = {
    enable = true;
    project.name = "cmugpt-surface";
    bun.enable = true;
    secrets.enable = true;
    postgres.enable = true;

    kennel.services.api = {
      customDomain = "api.cmugpt.scottylabs.org";
      oidc.redirectPaths = [ "/auth/callback" ];
    };
    kennel.sites.web = {
      spa = true;
    };
  };

  processes = {
    api.exec = "bun run --cwd apps/server dev";
    web.exec = "bun run --cwd apps/web dev";
  };
}
