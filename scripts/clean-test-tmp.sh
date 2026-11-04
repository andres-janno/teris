#!/bin/sh
# scripts/clean-test-tmp.sh — kustutab /tmp-st vanad testikäivitaja vahekaustad (/tmp/<juhuslik>/ssr).
# /tmp on serveris mälus (1 GB); iga testikäivitus jätab ~2 MB maha ja täis /tmp murrab testid (ENOENT).
# Ainult selle kasutaja kaustad, mis on vanemad kui tund (käimasolevat käivitust ei puututa).
find "${TMPDIR:-/tmp}" -maxdepth 1 -mindepth 1 -type d -user "$(id -un)" -mmin +60 -exec test -d {}/ssr \; -exec rm -rf {} + 2>/dev/null
exit 0
