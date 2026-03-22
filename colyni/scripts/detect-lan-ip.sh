#!/usr/bin/env bash
# Best-effort IPv4 for the active default route (Wi‑Fi), then en0/en1 fallbacks.
# Source this file and call detect_lan_ip, or run: bash scripts/detect-lan-ip.sh
detect_lan_ip() {
  # Explicit override wins immediately
  if [[ -n "${LAN_IP:-}" ]]; then
    echo "$LAN_IP"
    return
  fi
  local ip=""
  if command -v route &>/dev/null; then
    local iface=""
    iface=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
    if [[ -n "$iface" ]] && command -v ipconfig &>/dev/null; then
      ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    fi
  fi
  if [[ -z "$ip" ]] && command -v ipconfig &>/dev/null; then
    ip=$(ipconfig getifaddr en0 2>/dev/null || true)
    [[ -z "$ip" ]] && ip=$(ipconfig getifaddr en1 2>/dev/null || true)
  fi
  if [[ -z "$ip" ]] && command -v hostname &>/dev/null; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  fi
  [[ -z "$ip" ]] && ip="127.0.0.1"
  echo "$ip"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  detect_lan_ip
fi
