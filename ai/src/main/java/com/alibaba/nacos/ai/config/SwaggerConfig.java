/*
 * Copyright 1999-2025 Alibaba Group Holding Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.alibaba.nacos.ai.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/**
 * Swagger Configuration for Nacos AI module.
 *
 * @author nacos
 */
@Configuration
public class SwaggerConfig {
    
    @Bean
    public OpenAPI nacosAiOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Nacos AI - A2A Admin API")
                        .description("Nacos Agent-to-Agent (A2A) Admin Interface API documentation")
                        .version("3.1.0")
                        .contact(new Contact()
                                .name("Nacos Team")
                                .url("https://nacos.io")
                                .email("nacos-dev@googlegroups.com"))
                        .license(new License()
                                .name("Apache License 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")))
                .servers(List.of(
                        new Server().url("/").description("Default Server")
                ));
    }
}