# Nacos A2A Admin API - Swagger Documentation

This directory contains the OpenAPI/Swagger documentation for the Nacos Agent-to-Agent (A2A) Admin interfaces.

## API Documentation Files

1. **a2a-admin-api.yaml** - OpenAPI specification in YAML format
2. **a2a-admin-api.json** - OpenAPI specification in JSON format

## API Endpoints

The A2A Admin API provides the following endpoints for managing AI agents:

### Agent Management
- `POST /v3/admin/ai/a2a` - Register a new agent
- `GET /v3/admin/ai/a2a` - Get agent card information
- `PUT /v3/admin/ai/a2a` - Update agent card information
- `DELETE /v3/admin/ai/a2a` - Delete an agent

### Agent Discovery
- `GET /v3/admin/ai/a2a/list` - List agents with pagination and search
- `GET /v3/admin/ai/a2a/version/list` - List all versions for a specific agent

## Accessing the Documentation

When the Nacos server is running, you can access the Swagger documentation at:

- **Swagger UI**: `http://localhost:8848/swagger-ui.html` (if enabled)
- **OpenAPI YAML**: `http://localhost:8848/v3/admin/ai/a2a/swagger.yaml`
- **OpenAPI JSON**: `http://localhost:8848/v3/admin/ai/a2a/swagger.json`

## Key Features

- **Agent Registration**: Register agents with detailed agent card specifications
- **Version Management**: Support for multiple agent versions with latest version tracking  
- **Search & Discovery**: Flexible search capabilities with pagination
- **Namespace Support**: Multi-tenant support with namespace isolation
- **Registration Types**: Support for both URL-based and service-based registration

## Request Parameters

### Common Parameters
- `namespaceId` - Namespace identifier (defaults to "default")
- `agentName` - Name of the agent (required for most operations)
- `version` - Agent version (optional, uses latest if not specified)
- `registrationType` - Either "url" or "service" registration type

### Agent Card Format
The `agentCard` parameter should contain a JSON string with the agent specification following the A2A protocol format. Example:

```json
{
  "name": "my-agent",
  "version": "1.0.0", 
  "description": "My AI agent",
  "url": "https://example.com/agent",
  "capabilities": {
    "tools": true,
    "resources": false,
    "prompts": true
  },
  "provider": {
    "name": "Example Provider",
    "url": "https://example.com"
  }
}
```

## Response Format

All API responses follow the standard Nacos Result format:

```json
{
  "code": 200,
  "message": "success",
  "data": {...},
  "success": true
}
```

## Authentication

The A2A Admin API uses Nacos's built-in authentication and authorization system. Ensure proper authentication headers are included with requests when security is enabled.