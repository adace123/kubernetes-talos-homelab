import * as pulumi from "@pulumi/pulumi";
import { remote } from "@pulumi/command";
import * as tls from "@pulumi/tls";
import * as talos from "@pulumiverse/talos";

import { configurationOutput } from "@pulumiverse/talos/client/configuration";
import { kubeconfigOutput } from "@pulumiverse/talos/cluster/kubeconfig";
import * as proxmox from "@muhlba91/pulumi-proxmoxve";

const config = new pulumi.Config();
const proxmoxEndpoint = config.requireSecret("proxmox-endpoint");
const username = config.requireSecret("proxmox-username");
const password = config.requireSecret("proxmox-password");
const privateKey = config.requireSecret("proxmox-private-key");

const talosVersion = config.require("talos-version");

const provider = new proxmox.Provider("proxmox", {
  endpoint: proxmoxEndpoint,
  username,
  password,
});
const talosVip = config.require("talos-vip");

const iso = new proxmox.storage.File(
  "talos-image",
  {
    contentType: "iso",
    datastoreId: "local",
    nodeName: "proxmox",
    sourceFile: {
      path: pulumi.interpolate`https://github.com/siderolabs/talos/releases/download/v${talosVersion}/nocloud-amd64.raw.xz`,
      fileName: pulumi.interpolate`talos-${talosVersion}-nocloud-amd64.iso`,
    },
  },
  { provider },
);

// const networkDataFile = new proxmox.storage.File(
//   "talos-network-data-file",
//   {
//     datastoreId: "local",
//     nodeName: "proxmox",
//     sourceRaw: {
//       data: `
//       #cloud-config
//       version: 2
//       ethernets:
//         ens18:
//           addresses: [192.168.4.80/24]
//           gateway4: 192.168.4.1
//           nameservers:
//             addresses: [8.8.8.8, 1.1.1.1]
//       renderer: networkd
//       `,
//       fileName: "network-config.yaml",
//     },
//   },
//   { provider },
// );

const unzipIso = new remote.Command(
  "unzip-iso",
  {
    connection: {
      host: "proxmox",
      user: "root",
      password: password,
      // privateKey,
    },
    create: pulumi.interpolate`
      ISO_PATH=/var/lib/vz/template/iso/talos-${talosVersion}-nocloud-amd64.iso
      mv $ISO_PATH $ISO_PATH.xz
      unxz -f $ISO_PATH.xz
    `,
  },
  { dependsOn: [iso] },
);

const resourcePool = new proxmox.permission.Pool(
  "talos-resource-pool",
  {
    poolId: "kubernetes",
  },
  { provider },
);

const controlPlane = new proxmox.vm.VirtualMachine(
  "talos-control-plane",
  {
    name: "talos-control-plane-1",
    description: "Talos cluster control plane",
    tags: ["talos", "control-plane"],
    nodeName: "proxmox",
    poolId: resourcePool.id,
    agent: {
      enabled: true,
      timeout: "1s",
    },
    cpu: {
      cores: 2,
      type: "host",
    },
    disks: [
      {
        datastoreId: "local",
        interface: "scsi0",
        size: 20,
        fileFormat: "raw",
        fileId: iso.id,
      },
    ],
    machine: "q35",
    memory: {
      dedicated: 8192,
    },
    operatingSystem: {
      type: "l26",
    },
    networkDevices: [
      {
        bridge: "vmbr0",
        model: "virtio",
        enabled: true,
        macAddress: "00:00:00:00:00:11",
      },
    ],
    vga: {
      enabled: true,
      type: "serial0",
      memory: 4,
    },
    initialization: {
      type: "nocloud",
      datastoreId: "local",
      ipConfigs: [
        {
          ipv4: {
            address: "192.168.4.80/24",
            gateway: "192.168.4.1",
          },
        },
      ],
      dns: {
        server: "1.1.1.1",
      },
    },
  },
  {
    provider,
    dependsOn: [unzipIso],
    ignoreChanges: ["boot", "network", "dsec", "disks"],
  },
);

const secrets = new talos.machine.Secrets("secrets", {});
const talosConfig = controlPlane.machine.apply((_) =>
  talos.machine.getConfigurationOutput({
    clusterName: "talos-dev",
    machineType: "controlplane",
    clusterEndpoint: pulumi.interpolate`https://${talosVip}:6443`,
    machineSecrets: secrets.machineSecrets,
  }),
);

const talosConfigApply = new talos.machine.ConfigurationApply(
  "configurationApply",
  {
    clientConfiguration: secrets.clientConfiguration,
    machineConfigurationInput: talosConfig.machineConfiguration,
    node: "192.168.4.80",
    configPatches: [
      JSON.stringify({
        machine: {
          network: {
            cni: {
              name: "none",
            },
            proxy: {
              disabled: true,
            },
            interfaces: [
              {
                interface: "eth0",
                dhcp: true,
                vip: { ip: talosVip },
              },
            ],
          },
          features: {
            kubernetesTalosAPIAccess: {
              enabled: true,
              allowedRoles: ["os:operator"],
              allowedKubernetesNamespaces: ["talos-system"],
            },
            kubePrism: {
              enabled: true,
              port: 7445,
            },
          },
          install: {
            extensions: [
              {
                image: "ghcr.io/siderolabs/qemu-guest-agent:8.1.0",
              },
            ],
          },
        },
      }),
    ],
  },
  { dependsOn: [controlPlane], parent: controlPlane },
);

const talosBootstrap = new talos.machine.Bootstrap(
  "controlplane-bootstrap",
  {
    node: "192.168.4.80",
    clientConfiguration: secrets.clientConfiguration,
  },
  { dependsOn: [talosConfigApply], parent: controlPlane },
);

export const talosClientConfig = configurationOutput({
  clientConfiguration: secrets.clientConfiguration,
  clusterName: "talos-dev",
  endpoints: ["192.168.4.80"],
}).talosConfig;

export const { kubeconfigRaw } = talosBootstrap.clientConfiguration.apply(
  (_) => {
    const { kubeconfigRaw } = kubeconfigOutput({
      clientConfiguration: secrets.clientConfiguration,
      node: "192.168.4.80",
    });

    return {
      kubeconfigRaw,
    };
  },
);
