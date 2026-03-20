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
IMAGE_TAG="${1:-nacos/nacos-server:local}"
BASE_IMAGE="${BASE_IMAGE:-eclipse-temurin:17-jre}"

"${SCRIPT_DIR}/prepare-local-distribution.sh"

echo "Building Docker image ${IMAGE_TAG}"
docker build --build-arg BASE_IMAGE="${BASE_IMAGE}" -t "${IMAGE_TAG}" "${BUILD_DIR}"