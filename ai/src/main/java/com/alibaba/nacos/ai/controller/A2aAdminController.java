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

import com.alibaba.nacos.ai.constant.Constants;
import com.alibaba.nacos.ai.form.a2a.admin.AgentCardForm;
import com.alibaba.nacos.ai.form.a2a.admin.AgentCardUpdateForm;
import com.alibaba.nacos.ai.form.a2a.admin.AgentForm;
import com.alibaba.nacos.ai.form.a2a.admin.AgentListForm;
import com.alibaba.nacos.ai.param.AgentHttpParamExtractor;
import com.alibaba.nacos.ai.service.a2a.A2aServerOperationService;
import com.alibaba.nacos.ai.utils.AgentRequestUtil;
import com.alibaba.nacos.api.ai.model.a2a.AgentCard;
import com.alibaba.nacos.api.ai.model.a2a.AgentCardDetailInfo;
import com.alibaba.nacos.api.ai.model.a2a.AgentCardVersionInfo;
import com.alibaba.nacos.api.ai.model.a2a.AgentVersionDetail;
import com.alibaba.nacos.api.annotation.NacosApi;
import com.alibaba.nacos.api.exception.NacosException;
import com.alibaba.nacos.api.exception.api.NacosApiException;
import com.alibaba.nacos.api.model.Page;
import com.alibaba.nacos.api.model.v2.Result;
import com.alibaba.nacos.auth.annotation.Secured;
import com.alibaba.nacos.core.model.form.PageForm;
import com.alibaba.nacos.core.paramcheck.ExtractorManager;
import com.alibaba.nacos.plugin.auth.constant.ActionTypes;
import com.alibaba.nacos.plugin.auth.constant.ApiType;
import com.alibaba.nacos.plugin.auth.constant.SignType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Nacos A2A Admin controller.
 *
 * @author nacos
 */
@NacosApi
@RestController
@RequestMapping(Constants.A2A.ADMIN_PATH)
@ExtractorManager.Extractor(httpExtractor = AgentHttpParamExtractor.class)
@Tag(name = "A2A Admin", description = "Agent-to-Agent Admin API for managing agents")
public class A2aAdminController {
    
    private final A2aServerOperationService a2aServerOperationService;
    
    public A2aAdminController(A2aServerOperationService a2aServerOperationService) {
        this.a2aServerOperationService = a2aServerOperationService;
    }
    
    /**
     * Register agent.
     *
     * @param form the agent detail form to register
     * @return result of the registration operation
     * @throws NacosException if the agent registration fails due to invalid input or internal error
     */
    @PostMapping
    @Secured(action = ActionTypes.WRITE, signType = SignType.AI, apiType = ApiType.ADMIN_API)
    @Operation(summary = "Register Agent", description = "Register a new agent with agent card information")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Agent registered successfully",
                    content = @Content(schema = @Schema(implementation = Result.class))),
            @ApiResponse(responseCode = "400", description = "Invalid input parameters"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    public Result<String> registerAgent(
            @Parameter(description = "Agent card form containing agent information", required = true)
            AgentCardForm form) throws NacosException {
        form.validate();
        AgentCard agentCard = AgentRequestUtil.parseAgentCard(form);
        a2aServerOperationService.registerAgent(agentCard, form.getNamespaceId(), form.getRegistrationType());
        return Result.success("ok");
    }
    
    /**
     * Get agent card.
     *
     * @param form the agent form to get
     * @return result of the get operation
     * @throws NacosApiException if the agent get fails due to invalid input or internal error
     */
    @GetMapping
    @Secured(action = ActionTypes.READ, signType = SignType.AI, apiType = ApiType.ADMIN_API)
    @Operation(summary = "Get Agent Card", description = "Retrieve agent card information by name and version")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Agent card retrieved successfully",
                    content = @Content(schema = @Schema(implementation = Result.class))),
            @ApiResponse(responseCode = "400", description = "Invalid input parameters"),
            @ApiResponse(responseCode = "404", description = "Agent not found"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    public Result<AgentCardDetailInfo> getAgentCard(
            @Parameter(description = "Agent form containing agent name and optional version", required = true)
            AgentForm form) throws NacosApiException {
        form.validate();
        return Result.success(
                a2aServerOperationService.getAgentCard(form.getNamespaceId(), form.getAgentName(), form.getVersion(),
                        form.getRegistrationType()));
    }
    
    /**
     * Update agent.
     *
     * @param form the agent update form to update
     * @return result of the update operation
     * @throws NacosException if the agent update fails due to invalid input or internal error
     */
    @PutMapping
    @Secured(action = ActionTypes.WRITE, signType = SignType.AI, apiType = ApiType.ADMIN_API)
    @Operation(summary = "Update Agent Card", description = "Update existing agent card information")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Agent card updated successfully",
                    content = @Content(schema = @Schema(implementation = Result.class))),
            @ApiResponse(responseCode = "400", description = "Invalid input parameters"),
            @ApiResponse(responseCode = "404", description = "Agent not found"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    public Result<String> updateAgentCard(
            @Parameter(description = "Agent card update form containing updated agent information", required = true)
            AgentCardUpdateForm form) throws NacosException {
        form.validate();
        AgentCard agentCard = AgentRequestUtil.parseAgentCard(form);
        a2aServerOperationService.updateAgentCard(agentCard, form.getNamespaceId(), form.getRegistrationType(),
                form.getSetAsLatest());
        return Result.success("ok");
    }
    
    /**
     * Delete agent.
     *
     * @param form the agent form to delete
     * @return result of the deletion operation
     * @throws NacosException if the agent deletion fails due to invalid input or internal error
     */
    @DeleteMapping
    @Secured(action = ActionTypes.WRITE, signType = SignType.AI, apiType = ApiType.ADMIN_API)
    @Operation(summary = "Delete Agent", description = "Delete an agent by name and version")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Agent deleted successfully",
                    content = @Content(schema = @Schema(implementation = Result.class))),
            @ApiResponse(responseCode = "400", description = "Invalid input parameters"),
            @ApiResponse(responseCode = "404", description = "Agent not found"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    public Result<String> deleteAgent(
            @Parameter(description = "Agent form containing agent name and version", required = true)
            AgentForm form) throws NacosException {
        form.validate();
        a2aServerOperationService.deleteAgent(form.getNamespaceId(), form.getAgentName(), form.getVersion());
        return Result.success("ok");
    }
    
    /**
     * List agents.
     *
     * @param agentListForm the agent list form to list
     * @param pageForm the page form to list
     * @return result of the list operation
     * @throws NacosException if the agent list fails due to invalid input or internal error
     */
    @GetMapping("/list")
    @Secured(action = ActionTypes.READ, signType = SignType.AI, apiType = ApiType.ADMIN_API)
    @Operation(summary = "List Agents", description = "List agents with pagination and optional search criteria")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Agent list retrieved successfully",
                    content = @Content(schema = @Schema(implementation = Result.class))),
            @ApiResponse(responseCode = "400", description = "Invalid input parameters"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    public Result<Page<AgentCardVersionInfo>> listAgents(
            @Parameter(description = "Agent list form with optional search criteria", required = true)
            AgentListForm agentListForm, 
            @Parameter(description = "Pagination form with page number and size", required = true)
            PageForm pageForm) throws NacosException {
        agentListForm.validate();
        pageForm.validate();
        return Result.success(
                a2aServerOperationService.listAgents(agentListForm.getNamespaceId(), agentListForm.getAgentName(),
                        agentListForm.getSearch(), pageForm.getPageNo(), pageForm.getPageSize()));
    }
    
    /**
     * List all versions for target Agent.
     *
     * @param agentForm agent form
     * @return all version for target agent.
     * @throws NacosException nacos exception
     */
    @GetMapping("/version/list")
    @Secured(action = ActionTypes.READ, signType = SignType.AI, apiType = ApiType.ADMIN_API)
    @Operation(summary = "List Agent Versions", description = "List all versions for a specific agent")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Agent versions retrieved successfully",
                    content = @Content(schema = @Schema(implementation = Result.class))),
            @ApiResponse(responseCode = "400", description = "Invalid input parameters"),
            @ApiResponse(responseCode = "404", description = "Agent not found"),
            @ApiResponse(responseCode = "500", description = "Internal server error")
    })
    public Result<List<AgentVersionDetail>> listAgentVersions(
            @Parameter(description = "Agent form containing agent name", required = true)
            AgentForm agentForm) throws NacosException {
        agentForm.validate();
        return Result.success(
                a2aServerOperationService.listAgentVersions(agentForm.getNamespaceId(), agentForm.getAgentName()));
    }
}
