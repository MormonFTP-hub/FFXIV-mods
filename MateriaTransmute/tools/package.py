"""Build Materia Transmuter for sharing: same as `python tools/package_plugin.py MateriaTransmute`.

Bump <Version> in MateriaTransmute.csproj first, or Dalamud won't offer the update to anyone who has it.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.exit(subprocess.run([sys.executable, str(ROOT / 'tools' / 'package_plugin.py'), 'MateriaTransmute']).returncode)
