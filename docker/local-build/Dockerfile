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

ARG BASE_IMAGE=eclipse-temurin:17-jre
FROM ${BASE_IMAGE}

ENV MODE="cluster" \
    PREFER_HOST_MODE="ip" \
    BASE_DIR="/home/nacos" \
    CLASSPATH=".:/home/nacos/conf:$CLASSPATH" \
    CLUSTER_CONF="/home/nacos/conf/cluster.conf" \
    FUNCTION_MODE="all" \
    JVM_XMS="1g" \
    JVM_XMX="1g" \
    JVM_XMN="512m" \
    JVM_MS="128m" \
    JVM_MMS="320m" \
    NACOS_DEBUG="n" \
    TOMCAT_ACCESSLOG_ENABLED="false" \
    TZ="Asia/Shanghai"

WORKDIR /home

COPY dist/nacos-server.tar.gz /tmp/nacos-server.tar.gz

RUN mkdir -p /home/nacos \
    && tar -xzf /tmp/nacos-server.tar.gz -C /home \
    && rm -f /tmp/nacos-server.tar.gz \
    && mkdir -p /home/nacos/logs \
    && chmod +x /home/nacos/bin/*.sh

COPY bin/docker-startup.sh /home/nacos/bin/docker-startup.sh

RUN chmod +x /home/nacos/bin/docker-startup.sh

WORKDIR /home/nacos

EXPOSE 8080 8848 9848 9849 7848

ENTRYPOINT ["/home/nacos/bin/docker-startup.sh"]