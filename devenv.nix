{ inputs, ... }:

{
  imports = [
    inputs.scottylabs.devenvModules.default
  ];

  scottylabs = {
    enable = true;
    project.name = "cmugpt-surface";

    secrets.enable = true;
    postgres.enable = true;
    ricochet = {
      enable = true;
      # Public URL of the web dev server (vite --port 4173); exported as APP_URL
      # and used as the OAuth `return_to` the local relay bounces codes back to.
      appUrl = "http://localhost:4173";
    };

    deno = {
      enable = true;
      react.enable = true;
    };

    # The api binary serves the built frontend from STATIC_DIR (baked in the
    # flake), so a single kennel service deploys both. See flake.nix.
    kennel.services.link-shortener.customDomain = "cmugpt.com";
  };

  # Backend on :3001; the server task loads ../../.env for SERVER_URL /
  # ALLOWED_ORIGINS_REGEX, secretspec provides OIDC/AGENT, postgres sets
  # DATABASE_URL.
  processes.api = {
    exec = "deno install && deno task dev";
    cwd = "./apps/server";
    env.PORT = "3001";
  };

  # Frontend (Vite) on :4173, proxying /api -> backend.
  processes.web = {
    exec = "deno install && deno task dev";
    cwd = "./apps/web";
  };
}
