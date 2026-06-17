#!/bin/bash

# Enforce script execution with root/sudo privileges
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run this script with sudo privileges."
  exit 1
fi

echo "Initializing host storage path for k3s local-path provisioner..."

# Create the storage directory structure if it does not exist
mkdir -p /opt/local-path-provisioner

# Grant full read, write, and execute permissions to prevent MongoDB disk locks
chmod -R 777 /opt/local-path-provisioner

echo "Success: Storage path ready for database deployment."
