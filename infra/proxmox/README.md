# Proxmox homelab contract

Maak minimaal deze VM's: vm-coolify, vm-spaartrack-stg, vm-spaartrack-prod, vm-observability en vm-recovery.

Gebruik vaste interne DNS/IP's, NTP en een management-VLAN. Publiceer alleen HTTPS via de gekozen reverse proxy/tunnel. VM snapshots vervangen geen PostgreSQL- of object-storage-backups.

Restore-rehearsal is verplicht voor iedere release met een migration- of persistence-impact.
