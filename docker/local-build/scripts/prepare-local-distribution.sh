#!/bin/bash

# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${BUILD_DIR}/../.." && pwd)"
DIST_DIR="${BUILD_DIR}/dist"
DIST_TARGET_DIR="${REPO_ROOT}/distribution/target"

cd "${REPO_ROOT}"

echo "[1/3] Building local Nacos distribution package"
./mvnw -pl distribution -am -Prelease-nacos -DskipTests -Drat.skip=true install

echo "[2/3] Locating locally built distribution archive"
ARCHIVE_PATH="$(find "${DIST_TARGET_DIR}" -maxdepth 1 -type f \( -name 'nacos-server-*.tar.gz' -o -name 'nacos-*.tar.gz' \) | sort | tail -n 1)"

if [ -z "${ARCHIVE_PATH}" ]; then
    echo "Unable to find a locally built Nacos server archive under ${DIST_TARGET_DIR}" >&2
    exit 1
fi

mkdir -p "${DIST_DIR}"
cp "${ARCHIVE_PATH}" "${DIST_DIR}/nacos-server.tar.gz"

echo "[3/3] Prepared Docker build input"
echo "Archive: ${ARCHIVE_PATH}"
echo "Docker context file: ${DIST_DIR}/nacos-server.tar.gz"