# godot-tool

Binaire Godot 4.5 (Linux x86_64) compressé, pour usage dans un conteneur cloud
éphémère (session Claude Code, CI, sandbox) — sans dépendance réseau ni
gestionnaire de paquets, utile pour le portage documenté dans `PLAN_GODOT.md`.

## Utilisation

```bash
./godot-tool/setup.sh
./godot-tool/godot --version
```

Pour un lien global (`godot45` dans le PATH) :

```bash
./godot-tool/setup.sh --link godot45
godot45 --version
```

## Contenu

- `godot.xz` — binaire Godot 4.5 stable compressé en xz (~56 Mo ; ~144 Mo décompressé).
- `setup.sh` — décompresse et rend l'exécutable disponible.

Le binaire décompressé (`godot`) n'est pas versionné (voir `.gitignore`) : il est
recréé par `setup.sh` à chaque conteneur.

## Notes

- Build headless standard, sans templates d'export embarqués. Pour l'export
  web (WebAssembly), il faudra installer séparément les templates d'export
  Godot 4.5 correspondants (voir `PLAN_GODOT.md`, lot 0).
- `godot --version` doit afficher `4.5.stable.custom_build.*`.
