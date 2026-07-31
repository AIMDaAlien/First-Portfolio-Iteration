#!/usr/bin/env bash
set -euo pipefail

# Publish a sanitized metrics snapshot into the existing Caddy document root.
# This script intentionally exposes no hostnames, IP addresses, device names,
# mount paths, container names, or credentials.

OUTPUT_FILE="${OUTPUT_FILE:-/mnt/user/appdata/penthouse/app/infra/compose/site/public/unraid-metrics.json}"
OUTPUT_DIR="$(dirname "$OUTPUT_FILE")"
TEMP_FILE="${OUTPUT_FILE}.tmp"

read_cpu_sample() {
    read -r _ user nice system idle iowait irq softirq steal _ < /proc/stat
    CPU_IDLE=$((idle + iowait))
    CPU_TOTAL=$((user + nice + system + idle + iowait + irq + softirq + steal))
}

read_cpu_sample
cpu_idle_start=$CPU_IDLE
cpu_total_start=$CPU_TOTAL
sleep 1
read_cpu_sample

cpu_idle_delta=$((CPU_IDLE - cpu_idle_start))
cpu_total_delta=$((CPU_TOTAL - cpu_total_start))
if ((cpu_total_delta > 0)); then
    cpu_pct=$(awk -v idle="$cpu_idle_delta" -v total="$cpu_total_delta" 'BEGIN { printf "%.1f", (1 - idle / total) * 100 }')
else
    cpu_pct="0.0"
fi

ram_used_gb=$(awk '/MemTotal:/ { total=$2 } /MemAvailable:/ { available=$2 } END { printf "%.1f", (total-available)/1048576 }' /proc/meminfo)
ram_total_gb=$(dmidecode --type 17 2>/dev/null | awk '/^[[:space:]]*Size: [0-9]+ GB/ { total += $2 } END { if (total > 0) print total; else print 128 }')

read -r array_total_bytes array_used_bytes < <(df -B1 --output=size,used /mnt/user | awk 'NR == 2 { print $1, $2 }')
array_total_tb=$(awk -v bytes="$array_total_bytes" 'BEGIN { printf "%.1f", bytes/1000000000000 }')
array_used_tb=$(awk -v bytes="$array_used_bytes" 'BEGIN { printf "%.1f", bytes/1000000000000 }')

uptime_days=$(awk '{ print int($1/86400) }' /proc/uptime)
temp_c=$(sensors 2>/dev/null | awk '/Package id 0:/ { gsub(/[+°C]/, "", $4); print int($4 + 0.5); exit }')
temp_c="${temp_c:-0}"
docker_ct=$(docker ps -q 2>/dev/null | wc -l | tr -d ' ')
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

mkdir -p "$OUTPUT_DIR"
printf '{"ts":"%s","cpu_pct":%s,"ram_used_gb":%s,"ram_total_gb":%s,"array_used_tb":%s,"array_total_tb":%s,"uptime_days":%s,"temp_c":%s,"docker_ct":%s}\n' \
    "$timestamp" "$cpu_pct" "$ram_used_gb" "$ram_total_gb" "$array_used_tb" "$array_total_tb" \
    "$uptime_days" "$temp_c" "$docker_ct" > "$TEMP_FILE"
chmod 0644 "$TEMP_FILE"
mv -f "$TEMP_FILE" "$OUTPUT_FILE"
