#!/usr/bin/env bash

# Root directory of app
ROOT_DIR=$(git rev-parse --show-toplevel)

# Path to Protoc Plugin
PROTOC_GEN_TS_PATH="${ROOT_DIR}/node_modules/.bin/protoc-gen-ts_proto.cmd"

# Directory holding all .proto files
SRC_DIR="${ROOT_DIR}/proto"

# Directory to write generated code (.d.ts files)
OUT_DIR="${ROOT_DIR}/src/gen"

# Clean all existing generated files


# Generate all messages
protoc \
    --plugin="protoc-gen-ts=${PROTOC_GEN_TS_PATH}" \
    --js_out="import_style=commonjs,binary:${OUT_DIR}" \
    --ts_out="${OUT_DIR}" \
    --proto_path="${SRC_DIR}" \
    ${ROOT_DIR}/proto/packet.proto

