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

package com.alibaba.nacos.ai.controller;

import io.swagger.v3.oas.annotations.Hidden;
import org.springdoc.core.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * A2A Admin API documentation controller.
 *
 * @author nacos
 */
@RestController
@Configuration
public class A2aAdminDocController {
    
    /**
     * Configure grouped OpenAPI for A2A Admin API.
     *
     * @return GroupedOpenApi for A2A Admin
     */
    @Bean
    public GroupedOpenApi a2aAdminApi() {
        return GroupedOpenApi.builder()
                .group("a2a-admin")
                .pathsToMatch("/v3/admin/ai/a2a/**")
                .build();
    }
    
    /**
     * Serve the Swagger YAML file for A2A Admin API.
     *
     * @return OpenAPI specification in YAML format
     * @throws IOException if file cannot be read
     */
    @GetMapping(value = "/v3/admin/ai/a2a/swagger.yaml", produces = "application/x-yaml")
    @Hidden
    public ResponseEntity<String> getSwaggerYaml() throws IOException {
        try (InputStream yamlInputStream = getClass().getResourceAsStream("/a2a-admin-api.yaml")) {
            if (yamlInputStream != null) {
                String yamlContent = new String(yamlInputStream.readAllBytes(), StandardCharsets.UTF_8);
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType("application/x-yaml"))
                        .body(yamlContent);
            }
        }
        return ResponseEntity.notFound().build();
    }
    
    /**
     * Serve the Swagger JSON file for A2A Admin API.
     *
     * @return OpenAPI specification in JSON format
     * @throws IOException if file cannot be read
     */
    @GetMapping(value = "/v3/admin/ai/a2a/swagger.json", produces = MediaType.APPLICATION_JSON_VALUE)
    @Hidden
    public ResponseEntity<String> getSwaggerJson() throws IOException {
        try (InputStream jsonInputStream = getClass().getResourceAsStream("/a2a-admin-api.json")) {
            if (jsonInputStream != null) {
                String jsonContent = new String(jsonInputStream.readAllBytes(), StandardCharsets.UTF_8);
                return ResponseEntity.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(jsonContent);
            }
        }
        return ResponseEntity.notFound().build();
    }
}