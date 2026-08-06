{ inputs, ... }:

{
  imports = [
    inputs.scottylabs.devenvModules.default
  ];

  scottylabs = {
    enable = true;
    project.name = "cmugpt-surface";

    conventionalCommits.enable = false;

    secrets.enable = true;
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

    kennel = {
      sites.web = {
        spa = true;
        customDomain = "cmugpt.com";
      };
      services.api.customDomain = "api.cmugpt.com";
    };
  };

  processes.api = {
    exec = "deno install && deno task dev";
    cwd = "./apps/server";
    env.PORT = "3001";
  };

  processes.web = {
    exec = "deno install && deno task dev";
    cwd = "./apps/web";
  };
}
