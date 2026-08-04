#!/usr/bin/env bash
# Décompresse le binaire Godot 4.5 (headless/export-templates non inclus) présent dans
# ce dossier et le rend exécutable, pour utilisation dans un conteneur cloud éphémère
# (pas de dépendance à un gestionnaire de paquets, pas de téléchargement réseau).
#
# Usage :
#   ./godot-tool/setup.sh                 # décompresse ici, crée ./godot-tool/godot
#   ./godot-tool/setup.sh --link godot45  # + symlink global (nécessite les droits d'écriture sur /usr/local/bin)
#
# Après exécution : ./godot-tool/godot --version

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE="$SCRIPT_DIR/godot.xz"
BINARY="$SCRIPT_DIR/godot"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Erreur : $ARCHIVE introuvable." >&2
  exit 1
fi

if [[ -x "$BINARY" ]] && "$BINARY" --version >/dev/null 2>&1; then
  echo "Binaire déjà présent et fonctionnel : $BINARY"
else
  echo "Décompression de $ARCHIVE…"
  xz -dk -f "$ARCHIVE"
  chmod +x "$BINARY"
fi

"$BINARY" --version

LINK_NAME=""
if [[ "${1:-}" == "--link" ]]; then
  LINK_NAME="${2:-godot45}"
fi

if [[ -n "$LINK_NAME" ]]; then
  TARGET="/usr/local/bin/$LINK_NAME"
  if ln -sf "$BINARY" "$TARGET" 2>/dev/null; then
    echo "Lien créé : $TARGET -> $BINARY"
  elif sudo ln -sf "$BINARY" "$TARGET" 2>/dev/null; then
    echo "Lien créé (sudo) : $TARGET -> $BINARY"
  else
    echo "Impossible de créer le lien global $TARGET (droits insuffisants)." >&2
    echo "Utilisez directement : $BINARY" >&2
  fi
fi

echo "Prêt : $BINARY --version"
