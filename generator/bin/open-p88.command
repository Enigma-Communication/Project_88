#!/bin/bash
# Double-click to open a Terminal window ready to run p88.
PHOTOS="/Users/will/Desktop/Project 88/example images"
BIN="/Users/will/Desktop/Project 88/generator/bin"

osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "cd \"$PHOTOS\" && export PATH=\"$BIN:\$PATH\" && clear && p88-banner"
end tell
APPLESCRIPT
