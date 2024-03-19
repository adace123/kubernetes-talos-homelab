bootstrap-vm:
  #!/usr/bin/env nu
  #if (ps | where name =~ "libvirtd" | is-empty) {
  #  echo "Starting libvirtd"
  #  libvirtd -d
  #}

  pulumi up --cwd infra-ts -s dev -y

destroy-vm:
  #!/usr/bin/env nu
  pulumi destroy --cwd infra-ts -s dev -y
  #if not (ps | where name =~ "libvirtd" | is-empty) {
  #  echo "Terminating libvirtd"
  #  pkill -9 libvirtd
  #}
