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

set -eu

BASE_DIR="${BASE_DIR:-/home/nacos}"
CLUSTER_CONF="${CLUSTER_CONF:-${BASE_DIR}/conf/cluster.conf}"
CUSTOM_SEARCH_LOCATIONS="file:${BASE_DIR}/conf/"
MODE="${MODE:-cluster}"
FUNCTION_MODE="${FUNCTION_MODE:-all}"
PREFER_HOST_MODE="${PREFER_HOST_MODE:-ip}"
DEPLOYMENT_TYPE="${NACOS_DEPLOYMENT_TYPE:-merged}"

resolve_java_cmd() {
    if [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
        echo "${JAVA_HOME}/bin/java"
        return
    fi
    if command -v java >/dev/null 2>&1; then
        command -v java
        return
    fi
    echo "java command not found" >&2
    exit 1
}

append_opt() {
    if [ -n "${2:-}" ]; then
        JAVA_OPT="${JAVA_OPT} -D$1=$2"
    fi
}

prepare_cluster_conf() {
    if [ -n "${NACOS_SERVERS:-}" ]; then
        mkdir -p "$(dirname "${CLUSTER_CONF}")"
        : > "${CLUSTER_CONF}"
        for server in ${NACOS_SERVERS}; do
            echo "${server}" >> "${CLUSTER_CONF}"
        done
    fi
}

JAVA_CMD="$(resolve_java_cmd)"
JAVA_OPT=""

if [ "${MODE}" = "standalone" ]; then
    JAVA_OPT="${JAVA_OPT} -Xms512m -Xmx512m -Xmn256m -Dnacos.standalone=true"
else
    JAVA_OPT="${JAVA_OPT} -server -Xms${JVM_XMS:-1g} -Xmx${JVM_XMX:-1g} -Xmn${JVM_XMN:-512m} -XX:MetaspaceSize=${JVM_MS:-128m} -XX:MaxMetaspaceSize=${JVM_MMS:-320m}"
    JAVA_OPT="${JAVA_OPT} -XX:-OmitStackTraceInFastThrow -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=${BASE_DIR}/logs/java_heapdump.hprof -XX:-UseLargePages"
    if [ "${EMBEDDED_STORAGE:-}" = "embedded" ]; then
        JAVA_OPT="${JAVA_OPT} -DembeddedStorage=true"
    fi
fi

if [ "${FUNCTION_MODE}" = "config" ] || [ "${FUNCTION_MODE}" = "naming" ]; then
    JAVA_OPT="${JAVA_OPT} -Dnacos.functionMode=${FUNCTION_MODE}"
fi

prepare_cluster_conf

append_opt "nacos.member.list" "${MEMBER_LIST:-}"
append_opt "nacos.server.ip" "${NACOS_SERVER_IP:-}"
append_opt "nacos.server.main.port" "${NACOS_SERVER_PORT:-}"
append_opt "nacos.inetutils.use-only-site-local-interfaces" "${USE_ONLY_SITE_INTERFACES:-}"
append_opt "nacos.inetutils.preferred-networks" "${PREFERRED_NETWORKS:-}"
append_opt "nacos.inetutils.ignored-interfaces" "${IGNORED_INTERFACES:-}"
append_opt "nacos.core.auth.enabled" "${NACOS_AUTH_ENABLE:-}"
append_opt "nacos.core.auth.admin.enabled" "${NACOS_AUTH_ADMIN_ENABLE:-}"
append_opt "nacos.core.auth.console.enabled" "${NACOS_AUTH_CONSOLE_ENABLE:-}"
append_opt "nacos.core.auth.plugin.nacos.token.secret.key" "${NACOS_AUTH_TOKEN:-}"
append_opt "nacos.core.auth.plugin.nacos.token.expire.seconds" "${NACOS_AUTH_TOKEN_EXPIRE_SECONDS:-}"
append_opt "nacos.core.auth.server.identity.key" "${NACOS_AUTH_IDENTITY_KEY:-}"
append_opt "nacos.core.auth.server.identity.value" "${NACOS_AUTH_IDENTITY_VALUE:-}"
append_opt "nacos.security.ignore.urls" "${NACOS_SECURITY_IGNORE_URLS:-}"
append_opt "nacos.console.ui.enabled" "${NACOS_CONSOLE_UI_ENABLED:-}"
append_opt "nacos.core.param.check.enabled" "${NACOS_CORE_PARAM_CHECK_ENABLED:-}"
append_opt "nacos.console.port" "${NACOS_CONSOLE_PORT:-}"
append_opt "nacos.console.contextPath" "${NACOS_CONSOLE_CONTEXTPATH:-}"
append_opt "nacos.ai.mcp.registry.port" "${NACOS_AI_MCP_REGISTRY_PORT:-}"
append_opt "nacos.deployment.type" "${DEPLOYMENT_TYPE}"

if [ "${PREFER_HOST_MODE}" = "hostname" ]; then
    JAVA_OPT="${JAVA_OPT} -Dnacos.preferHostnameOverIp=true"
fi

if [ -n "${SPRING_DATASOURCE_PLATFORM:-}" ]; then
    append_opt "spring.sql.init.platform" "${SPRING_DATASOURCE_PLATFORM}"
fi

if [ "${SPRING_DATASOURCE_PLATFORM:-}" = "mysql" ]; then
    MYSQL_SERVICE_PORT="${MYSQL_SERVICE_PORT:-3306}"
    MYSQL_SERVICE_DB_NAME="${MYSQL_SERVICE_DB_NAME:-nacos}"
    MYSQL_SERVICE_DB_PARAM="${MYSQL_SERVICE_DB_PARAM:-characterEncoding=utf8&connectTimeout=1000&socketTimeout=3000&autoReconnect=true&useUnicode=true&useSSL=false&serverTimezone=UTC}"
    append_opt "db.num" "${MYSQL_DATABASE_NUM:-1}"
    append_opt "db.url.0" "${DB_URL_0:-jdbc:mysql://${MYSQL_SERVICE_HOST:-mysql}:${MYSQL_SERVICE_PORT}/${MYSQL_SERVICE_DB_NAME}?${MYSQL_SERVICE_DB_PARAM}}"
    append_opt "db.user" "${MYSQL_SERVICE_USER:-}"
    append_opt "db.password" "${MYSQL_SERVICE_PASSWORD:-}"
fi

JAVA_MAJOR_VERSION="$(${JAVA_CMD} -version 2>&1 | sed -E -n 's/.* version "([0-9]*).*$/\1/p')"
if [ -z "${JAVA_MAJOR_VERSION}" ]; then
    JAVA_MAJOR_VERSION=17
fi

if [ "${JAVA_MAJOR_VERSION}" -ge 9 ]; then
    JAVA_OPT="${JAVA_OPT} -Xlog:gc*:file=${BASE_DIR}/logs/nacos_gc.log:time,tags:filecount=10,filesize=100m"
    JAVA_OPT="${JAVA_OPT} --add-opens=java.base/java.lang=ALL-UNNAMED"
    JAVA_OPT="${JAVA_OPT} --add-opens=java.base/java.lang.reflect=ALL-UNNAMED"
    JAVA_OPT="${JAVA_OPT} --add-opens=java.base/java.util=ALL-UNNAMED"
fi

JAVA_OPT="${JAVA_OPT} -Dloader.path=${BASE_DIR}/plugins,${BASE_DIR}/plugins/health,${BASE_DIR}/plugins/cmdb,${BASE_DIR}/plugins/selector"
JAVA_OPT="${JAVA_OPT} -Dnacos.home=${BASE_DIR}"
JAVA_OPT="${JAVA_OPT} -jar ${BASE_DIR}/target/nacos-server.jar"
JAVA_OPT="${JAVA_OPT} --spring.config.additional-location=${CUSTOM_SEARCH_LOCATIONS}"
JAVA_OPT="${JAVA_OPT} --logging.config=${BASE_DIR}/conf/nacos-logback.xml"
JAVA_OPT="${JAVA_OPT} --server.max-http-request-header-size=524288"

mkdir -p "${BASE_DIR}/logs"

echo "Starting Nacos with mode=${MODE}, functionMode=${FUNCTION_MODE}, deployment=${DEPLOYMENT_TYPE}"
exec "${JAVA_CMD}" ${JAVA_OPT}