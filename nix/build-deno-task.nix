# Local override of scottylabs.mkLib's buildDenoTask.
#
# Identical to the upstream helper (ScottyLabs/devenv lib/build-deno-task.nix)
# except the npm tarball extraction adds `--delay-directory-restore`.
#
# Some npm tarballs declare their internal directories read-only (e.g. `cjs/`,
# `esm/` with mode dr-xr-xr-x). Plain `tar -x` creates the directory with that
# mode and then fails to write the files into it ("Cannot open: Permission
# denied"). `--delay-directory-restore` makes tar keep directories writable
# during extraction and apply the archived modes only at the end.
#
# TODO: drop this file once the fix lands upstream in ScottyLabs/devenv and the
# `scottylabs` flake input is bumped past it.
{
  lib,
  stdenv,
  deno,
  autoPatchelfHook,
  fetchurl,
  runCommand,
}:

{
  src,
  pname,
  version ? "0.1.0",
  task ? "build",
  output ? "dist",
  entrypoint ? null,
  # provision denort so `deno compile` runs inside the offline sandbox
  compile ? false,
}:

let
  lock = builtins.fromJSON (builtins.readFile (src + "/deno.lock"));

  parse =
    key:
    let
      # split name@version, bounding the version at the first "_" to drop Deno's "_peer" suffix
      m = builtins.match "(@?[^@]+)@([^_]+).*" key;
    in
    {
      name = builtins.elemAt m 0;
      version = builtins.elemAt m 1;
    };

  tarballs = lib.mapAttrs' (
    key: info:
    let
      p = parse key;
      unscoped = lib.last (lib.splitString "/" p.name);
    in
    lib.nameValuePair "${p.name}@${p.version}" {
      inherit (p) name version;
      tarball = fetchurl {
        url = "https://registry.npmjs.org/${p.name}/-/${unscoped}-${p.version}.tgz";
        hash = info.integrity;
      };
    }
  ) (lock.npm or { });

  # the npm cache deno reads is just the extracted tarball per version
  denoCache = runCommand "${pname}-deno-cache" { } ''
    mkdir -p "$out/npm/registry.npmjs.org"
    ${lib.concatStringsSep "\n" (
      lib.mapAttrsToList (_: p: ''
        dest="$out/npm/registry.npmjs.org/${p.name}/${p.version}"
        mkdir -p "$dest"
        tar -xzf ${p.tarball} -C "$dest" --strip-components=1 --delay-directory-restore
      '') tarballs
    )}
  '';

  # patchelf linux addons, dropping musl which it cannot fix
  patchAddons = lib.optionalString stdenv.isLinux ''
    if [ -d node_modules ]; then
      find node_modules -path '*-musl*' -name '*.node' -delete
      autoPatchelf node_modules
    fi
  '';
in
stdenv.mkDerivation {
  inherit pname version src;

  nativeBuildInputs = [ deno ] ++ lib.optional stdenv.isLinux autoPatchelfHook;
  buildInputs = lib.optionals stdenv.isLinux [ stdenv.cc.cc.lib ];
  dontAutoPatchelf = true;
  # strip/patchelf would corrupt the trailer deno compile appends
  dontStrip = compile;
  dontPatchELF = compile;

  configurePhase = ''
    runHook preConfigure
    export HOME="$TMPDIR"
    export DENO_DIR="$TMPDIR/deno"
    mkdir -p "$DENO_DIR"
    cp -r ${denoCache}/npm "$DENO_DIR/npm"
    chmod -R u+w "$DENO_DIR"
    ${lib.optionalString compile ''export DENORT_BIN="${deno.denort}/bin/denort"''}
    deno install --cached-only --frozen${
      lib.optionalString (entrypoint != null) " --entrypoint ${lib.escapeShellArg entrypoint}"
    }
    ${patchAddons}
    runHook postConfigure
  '';

  buildPhase = ''
    runHook preBuild
    deno task ${task}
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    cp -r ${output} "$out"
    runHook postInstall
  '';
}
