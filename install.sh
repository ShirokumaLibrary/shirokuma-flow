#!/bin/bash
#
# shirokuma-flow installer
#
# Installs shirokuma-flow to ~/.local/ without requiring sudo.
# Claude Code users already have ~/.local/bin in PATH.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash
#
#   # prerelease (alpha) channel (#2647):
#   curl -fsSL https://raw.githubusercontent.com/ShirokumaLibrary/shirokuma-flow/main/install.sh | bash -s -- --prerelease
#
# Options:
#   --prerelease   Install CLI from npm dist-tag 'alpha' instead of 'latest'.
#                  Pair with `shirokuma-flow plugin install --prerelease` to
#                  switch the plugin marketplace to ShirokumaDevelopment/shirokuma-plugins.
#
# Language is configured during `shirokuma-flow init --lang {en,ja}`, not at install time.
#
# Requirements:
#   - Node.js 20.0.0 or later
#   - npm (comes with Node.js)

set -eo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Installation directories
INSTALL_DIR="$HOME/.local/share/shirokuma-flow"
BIN_DIR="$HOME/.local/bin"
PACKAGE_NAME="@shirokuma-library/shirokuma-flow"
BIN_NAME="shirokuma-flow"

# Channel (stable | prerelease) - controls npm dist-tag
CHANNEL="stable"

# Print colored output
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

# Parse command-line arguments
# Note: --lang is accepted for backwards compatibility but ignored.
# Language configuration happens during `shirokuma-flow init --lang {en,ja}`.
#
# --prerelease: Install alpha/beta CLI from npm dist-tag `alpha`.
#               Combine with `shirokuma-flow plugin install --prerelease`
#               to switch the plugin marketplace as well.
parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --lang)
        shift 2 2>/dev/null || shift
        ;;
      --lang=*)
        shift
        ;;
      --prerelease)
        CHANNEL="prerelease"
        shift
        ;;
      *)
        shift
        ;;
    esac
  done
}

# Check Node.js version
check_node() {
  if ! command -v node &> /dev/null; then
    error "Node.js is not installed."
    echo "Please install Node.js 20.0.0 or later: https://nodejs.org/"
    exit 1
  fi

  local node_version
  node_version=$(node -v | sed 's/v//')
  local major_version
  major_version=$(echo "$node_version" | cut -d. -f1)

  if [ "$major_version" -lt 20 ]; then
    error "Node.js version $node_version is too old."
    echo "shirokuma-flow requires Node.js 20.0.0 or later."
    exit 1
  fi

  info "Node.js version: $node_version"
}

# Check npm availability
check_npm() {
  if ! command -v npm &> /dev/null; then
    error "npm is not installed."
    echo "Please install npm (usually comes with Node.js)."
    exit 1
  fi

  local npm_version
  npm_version=$(npm -v)
  info "npm version: $npm_version"
}

# Create directories
create_directories() {
  info "Creating installation directories..."
  mkdir -p "$INSTALL_DIR"
  mkdir -p "$BIN_DIR"
}

# Install the package
install_package() {
  local install_spec="$PACKAGE_NAME"
  if [ "$CHANNEL" = "prerelease" ]; then
    install_spec="$PACKAGE_NAME@alpha"
    info "Installing $install_spec (prerelease channel)..."
  else
    info "Installing $install_spec..."
  fi

  # Clean up existing installation if present
  if [ -d "$INSTALL_DIR/node_modules" ]; then
    warn "Removing existing installation..."
    rm -rf "$INSTALL_DIR/node_modules"
    rm -f "$INSTALL_DIR/package.json"
    rm -f "$INSTALL_DIR/package-lock.json"
  fi

  # Install the package (capture output for filtering)
  local npm_output
  if ! npm_output=$(npm install --prefer-online --prefix "$INSTALL_DIR" "$install_spec" 2>&1); then
    error "npm install failed:"
    echo "$npm_output" | grep -v '^npm WARN\|^npm notice' | head -20
    exit 1
  fi

  # Show filtered output (excluding npm notices/warnings)
  echo "$npm_output" | grep -v '^npm WARN\|^npm notice' | while read -r line; do
    if [ -n "$line" ]; then
      echo "  $line"
    fi
  done

  if [ ! -f "$INSTALL_DIR/node_modules/.bin/$BIN_NAME" ]; then
    error "Installation failed: binary not found."
    exit 1
  fi
}

# Create symlink in bin directory
create_symlink() {
  info "Creating symlink in $BIN_DIR..."

  local target="$INSTALL_DIR/node_modules/.bin/$BIN_NAME"
  local link="$BIN_DIR/$BIN_NAME"

  # Remove existing symlink if present
  if [ -L "$link" ] || [ -f "$link" ]; then
    rm -f "$link"
  fi

  ln -sf "$target" "$link"
  chmod +x "$link"

  success "Symlink created: $link -> $target"
}

# Check if PATH includes BIN_DIR
check_path() {
  if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo ""
    warn "$BIN_DIR is not in your PATH."
    echo ""
    echo "Add the following line to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
    echo ""
    echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
    echo "Then restart your terminal or run:"
    echo ""
    echo "  source ~/.bashrc  # or ~/.zshrc"
    echo ""
  fi
}

# Verify installation
verify_installation() {
  info "Verifying installation..."

  if [ -x "$BIN_DIR/$BIN_NAME" ]; then
    local version
    version=$("$BIN_DIR/$BIN_NAME" --version 2>/dev/null || echo "unknown")
    success "$BIN_NAME $version installed successfully!"
  else
    error "Installation verification failed."
    exit 1
  fi
}

# Print next steps
print_next_steps() {
  echo ""
  echo "========================================="
  echo "  Installation Complete!"
  echo "========================================="
  echo ""
  if [ "$CHANNEL" = "prerelease" ]; then
    echo "Channel: prerelease (alpha) — CLI installed from npm dist-tag 'alpha'."
    echo "         To also switch the plugin marketplace to prerelease, run:"
    echo "           shirokuma-flow plugin install --prerelease"
    echo ""
  fi
  echo "Next steps:"
  echo ""
  echo "  1. Set up GitHub authentication:"
  echo ""
  echo "     export GITHUB_TOKEN=\"ghp_xxxxx\"  # repo, read:project, project scopes"
  echo ""
  echo "     (or use: gh auth login && gh auth refresh -s read:project,project)"
  echo ""
  echo "  2. Initialize shirokuma-flow in your project:"
  echo ""
  echo "     cd /path/to/your/project"
  echo "     shirokuma-flow init --with-skills --lang {en,ja}"
  echo ""
  echo "  3. The init command will:"
  echo "     - Create .shirokuma/config.yaml"
  echo "     - Install shirokuma-skills-{en,ja} plugin"
  echo "     - Deploy rules to .claude/rules/shirokuma/"
  echo "     - Set language in .claude/settings.json"
  echo "     - Register plugin in Claude Code's cache"
  echo ""
  echo "  4. Start a new Claude Code session to use the skills"
  echo ""
  echo "Documentation: https://github.com/ShirokumaLibrary/shirokuma-flow"
  echo ""
}

# Main installation flow
main() {
  parse_args "$@"

  echo ""
  echo "========================================="
  echo "  shirokuma-flow Installer"
  echo "========================================="
  echo ""

  check_node
  check_npm
  create_directories
  install_package
  create_symlink
  check_path
  verify_installation
  print_next_steps
}

main "$@"
