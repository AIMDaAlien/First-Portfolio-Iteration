#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

# Publish a sanitized metrics snapshot into the existing Caddy document root.
# This script intentionally exposes no hostnames, IP addresses, device names,
# mount paths, container names, or credentials.

OUTPUT_FILE="${OUTPUT_FILE:-/mnt/user/appdata/penthouse/app/infra/compose/site/public/unraid-metrics.json}"
OUTPUT_DIR="$(dirname "$OUTPUT_FILE")"
TEMP_FILE="${OUTPUT_FILE}.tmp"

safe_number() {
    local value="${1:-}"
    local fallback="$2"

    if [[ "$value" =~ ^-?[0-9]+([.][0-9]+)?$ ]]; then
        printf '%s' "$value"
    else
        printf '%s' "$fallback"
    fi
}

read_cpu_sample() {
    if { read -r _ user nice system idle iowait irq softirq steal _ < /proc/stat; } 2>/dev/null; then
        CPU_IDLE=$((idle + iowait))
        CPU_TOTAL=$((user + nice + system + idle + iowait + irq + softirq + steal))
    else
        CPU_IDLE=0
        CPU_TOTAL=0
    fi
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

ram_used_gb="0.0"
ram_total_gb="0.0"
ram_sample="$(awk '/MemTotal:/ { total=$2 } /MemAvailable:/ { available=$2 } END { if (total < 0) total=0; if (available < 0) available=0; if (available > total) available=total; printf "%.1f %.1f", (total-available)/1048576, total/1048576 }' /proc/meminfo 2>/dev/null || true)"
if [[ "$ram_sample" =~ ^[0-9]+([.][0-9]+)?[[:space:]][0-9]+([.][0-9]+)?$ ]]; then
    read -r ram_used_gb ram_total_gb <<< "$ram_sample"
fi

array_total_bytes=0
array_used_bytes=0
array_sample="$(df -B1 --output=size,used /mnt/user 2>/dev/null | awk 'NR == 2 { print $1, $2 }' || true)"
if [[ "$array_sample" =~ ^[0-9]+[[:space:]][0-9]+$ ]]; then
    read -r array_total_bytes array_used_bytes <<< "$array_sample"
fi
array_total_tb=$(awk -v bytes="$array_total_bytes" 'BEGIN { printf "%.1f", bytes/1000000000000 }')
array_used_tb=$(awk -v bytes="$array_used_bytes" 'BEGIN { printf "%.1f", bytes/1000000000000 }')

uptime_days="$(awk '{ print int($1/86400) }' /proc/uptime 2>/dev/null || true)"
temp_c="$(sensors 2>/dev/null | awk '/Package id 0:/ { gsub(/[+°C]/, "", $4); print int($4 + 0.5); exit }' || true)"
docker_ct="$(docker ps -q 2>/dev/null | wc -l | tr -d ' ' || true)"
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cpu_pct="$(safe_number "$cpu_pct" "0.0")"
ram_used_gb="$(safe_number "$ram_used_gb" "0.0")"
ram_total_gb="$(safe_number "$ram_total_gb" "0.0")"
array_used_tb="$(safe_number "$array_used_tb" "0.0")"
array_total_tb="$(safe_number "$array_total_tb" "0.0")"
uptime_days="$(safe_number "$uptime_days" "0")"
temp_c="$(safe_number "$temp_c" "0")"
docker_ct="$(safe_number "$docker_ct" "0")"

mkdir -p "$OUTPUT_DIR"
printf '{"ts":"%s","cpu_pct":%s,"ram_used_gb":%s,"ram_total_gb":%s,"array_used_tb":%s,"array_total_tb":%s,"uptime_days":%s,"temp_c":%s,"docker_ct":%s}\n' \
    "$timestamp" "$cpu_pct" "$ram_used_gb" "$ram_total_gb" "$array_used_tb" "$array_total_tb" \
    "$uptime_days" "$temp_c" "$docker_ct" > "$TEMP_FILE"
chmod 0644 "$TEMP_FILE"
mv -f "$TEMP_FILE" "$OUTPUT_FILE"
