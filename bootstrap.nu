if (ps | where name =~ "libvirtd" | is-empty) {
  libvirtd -d
}

pulumi up --cwd infra -s dev -y
