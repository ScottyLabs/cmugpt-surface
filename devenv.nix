{ pkgs, config, inputs, ... }:
{
  imports = [ inputs.scottylabs.devenvModules.default ];

  nixpkgs.overlays = [ inputs.self.overlays.default ];

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

  processes.server = {
    exec = "${pkgs.webapp}/bin/cmugpt-surface-server";
    ready.http.get = {
      port = 80;
      path = "/";
    };
  };
}
