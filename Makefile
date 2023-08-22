# Set the correct pkg TARGET for each binary we build
# when building for linux-amd64, set the pkg target to node18-linuxstatic-x64
bin/linux-amd64/code-awareness: TARGET := node18-linuxstatic-x64
# output binary file ^      ^ variable ^ pkg target
bin/linux-arm64/code-awareness: TARGET := node18-linuxstatic-arm64
bin/darwin-amd64/code-awareness: TARGET := node18-macos-x64
bin/darwin-arm64/code-awareness: TARGET := node18-macos-arm64
bin/windows-x64/code-awareness.exe: TARGET := node18-win-x64
bin/windows-x32/code-awareness.exe: TARGET := node18-win

# Wildcard rule to build any of binary outputs
# "To build any bin file, ensure node_modules are up to date..."
bin/%: node_modules
	pkg --target ${TARGET} --output $@ ./dist-exe/index.js

# Running `make bins` will build all the listed outputs
bins: bin/linux-amd64/code-awareness
bins: bin/linux-arm64/code-awareness
bins: bin/darwin-amd64/code-awareness
bins: bin/darwin-arm64/code-awareness
bins: bin/windows-x64/code-awareness.exe
bins: bin/windows-x32/code-awareness.exe

# Let Make know that `bins` doesn't really exist (is phony) - it's just a helpful shortcut
.PHONY: bins
