{
  description = "Kubernetes homelab development";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nuenv.url = "github:DeterminateSystems/nuenv";
  };

  outputs = {
    nixpkgs,
    nuenv,
    ...
  }: let
    supportedSystems = ["x86_64-linux" "x86_64-darwin"];
    overlays = [
      nuenv.overlays.default
    ];
    forEachSupportedSystem = f:
      nixpkgs.lib.genAttrs supportedSystems (system:
        f {
          pkgs = import nixpkgs {inherit overlays system;};
        });
  in {
    devShells = forEachSupportedSystem ({pkgs}: {
      default = pkgs.mkShell {
        packages = with pkgs; [
          git
          alejandra
          just
          nushell
          (talosctl.override {buildGoModule = pkgs.buildGo120Module;})
          pulumi-bin
          nodejs
          typescript
          packer
        ];
      };
    });
  };
}
