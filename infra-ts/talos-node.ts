import * as pulumi from "@pulumi/pulumi";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";

interface TalosNodeConfig {
  isMaster: boolean;
  ipAddr: string;
  gatewayAddr: string;
}

class TalosNode extends pulumi.ComponentResource {
  private config: TalosNodeConfig;

  constructor(
    name: string,
    config: TalosNodeConfig,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("TalosNode", name, config, opts);
    this.config = config;
  }

  buildProxmoxVM() {
    const nodeVM = new proxmox.vm.VirtualMachine(this.name, {
      name: "",
    });
  }
}
