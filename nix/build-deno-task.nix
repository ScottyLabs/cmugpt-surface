# Builds a deno project with npm deps from deno.lock
{
  lib,
  stdenv,
  deno,
  autoPatchelfHook,
  fetchurl,
  runCommand,
  jq,
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
  # use sloppy imports when installing if using generator libraries like tsoa that emit extensionless imports
  sloppyImports ? false,
  # verify the lockfile is exactly reproducible offline. Disable for builds whose lock
  # references packages outside the build src (e.g. a sibling deno workspace member that
  # is imported for types only) — those cannot be re-derived in an isolated sandbox.
  frozen ? true,
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
      url = "https://registry.npmjs.org/${p.name}/-/${unscoped}-${p.version}.tgz";
    in
    lib.nameValuePair "${p.name}@${p.version}" {
      inherit (p) name version;
      inherit url;
      integrity = info.integrity;
      tarball = fetchurl {
        inherit url;
        hash = info.integrity;
      };
    }
  ) (lock.npm or { });

  # the npm cache deno reads is the extracted tarball per version, plus a synthesized registry.json per package so deno can resolve dependency and peer-dependency metadata offline.
  denoCache = runCommand "${pname}-deno-cache" { nativeBuildInputs = [ jq ]; } ''
    set -euo pipefail
    mkdir -p "$out/npm/registry.npmjs.org"
    missing=()
    ${lib.concatStringsSep "\n" (
      lib.mapAttrsToList (_: p: ''
        dest="$out/npm/registry.npmjs.org/${p.name}/${p.version}"
        mkdir -p "$dest"
        tar -xzf ${p.tarball} -C "$dest" --strip-components=1 --delay-directory-restore
        if [ -f "$dest/package.json" ]; then
          reg="$out/npm/registry.npmjs.org/${p.name}/registry.json"
          [ -f "$reg" ] || jq -n --arg n "${p.name}" '{name:$n,"dist-tags":{},versions:{}}' > "$reg"
          # Preserve the whole package.json in the synthesized registry, overriding only
          # version/dist and filtering optional peer deps. The previous cherry-pick dropped
          # os/cpu/bin/optionalDependencies, so deno's --frozen re-derivation of the lock
          # diverged from the committed lock (os/cpu/bin mismatches). Filtering optional
          # peers (peerDependenciesMeta[k].optional == true) also stops the offline resolver
          # from fetching peers absent from deno.lock (e.g. @tanstack/router-plugin's optional
          # @rsbuild/core). Local patch.
          jq --arg v "${p.version}" --arg integ "${p.integrity}" --arg tb "${p.url}" \
            'input as $pj
            | ($pj.peerDependenciesMeta // {}) as $meta
            | .versions[$v] = ($pj
                + {version:$v, dist:{tarball:$tb, integrity:$integ},
                    peerDependencies: (($pj.peerDependencies // {})
                      | with_entries(select(($meta[.key].optional // false) | not)))})
            | .["dist-tags"].latest = $v' \
            "$reg" "$dest/package.json" > "$reg.new"
          mv "$reg.new" "$reg"
        else
          missing+=("${p.name}@${p.version}")
        fi
      '') tarballs
    )}
    chmod -R u+rwX "$out"
    want=${toString (builtins.length (builtins.attrNames tarballs))}
    echo "deno-cache: $((want - ''${#missing[@]}))/$want packages extracted"
    if [ "''${#missing[@]}" -gt 0 ]; then
      echo "deno-cache: incomplete, missing package.json for:" >&2
      printf '    %s\n' "''${missing[@]}" >&2
      exit 1
    fi
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
    deno install --cached-only${lib.optionalString frozen " --frozen"}${lib.optionalString sloppyImports " --sloppy-imports"}${
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
