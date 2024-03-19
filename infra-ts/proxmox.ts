import * as proxmox from "@muhlba91/pulumi-proxmoxve";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config("proxmox-provider");

interface ProxmoxConfig {
  endpoint: string;
  username: string;
  password: string;
}

interface ProxmoxVMConfig {
  cores: pulumi.Output<number>;
  memory: pulumi.Output<number>;
  description: pulumi.Output<string>;
  ipAddr: pulumi.Output<string>;
}

class ProxmoxVMBuilder {
  constructor(config: ProxmoxConfig) { }
}
