This folder stores downloadable build artifacts for manual testing.

`MCP-Installer Setup 1.0.0.exe` is the Windows installer generated from the
latest local build.

The source fix in `deliverable-electron/scripts/build.ps1` improves recovery
from the intermittent corporate NSIS cache race seen during packaging.