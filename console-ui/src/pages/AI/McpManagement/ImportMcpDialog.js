/*
 * Copyright 1999-2018 Alibaba Group Holding Ltd.
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

import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Card,
  Checkbox,
  Dialog,
  Icon,
  Loading,
  Message,
  Pagination,
  Tab,
  Tag,
  Balloon,
  Upload,
} from '@alifd/next';
import { request } from '@/globalLib';

class ImportMcpDialog extends React.Component {
  static propTypes = {
    locale: PropTypes.object,
    visible: PropTypes.bool,
    onCancel: PropTypes.func,
    onImportSuccess: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      activeTab: 'public',
      loading: false,
      publicServers: [],
      selectedServers: [],
      selectedRowKeys: [],
      fileList: [],
      currentPage: 1,
      pageSize: 10,
      totalCount: 0,
      // 文件导入相关状态
      fileServers: [], // 从文件解析出的服务器列表
      fileSelectedServers: [], // 文件中被选中的服务器
      fileSelectedRowKeys: [], // 文件中被选中的服务器ID
      fileCurrentPage: 1, // 文件服务器列表的当前页
      fileTotalCount: 0, // 文件服务器总数
      fileStep: 'upload', // 'upload' | 'select'，文件导入的步骤
    };
  }

  componentDidMount() {
    if (this.props.visible) {
      this.loadPublicServers();
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.loadPublicServers();
    }
  }

  loadPublicServers = async (page = 1) => {
    const { pageSize } = this.state;
    this.setState({ loading: true });

    try {
      const offset = (page - 1) * pageSize;
      const result = await request({
        url: 'v3/console/ai/mcp/public-registry',
        method: 'get',
        data: {
          limit: pageSize,
          offset: offset,
        },
      });

      if (result.code === 0) {
        const responseData = JSON.parse(result.data);
        this.setState({
          publicServers: responseData.servers || [],
          totalCount:
            responseData.total || (responseData.servers ? responseData.servers.length : 0),
          currentPage: page,
          loading: false,
        });
      } else {
        Message.error(result.message || 'Failed to load servers');
        this.setState({ loading: false });
      }
    } catch (error) {
      Message.error('Failed to load servers from public registry');
      this.setState({ loading: false });
    }
  };

  handleServerSelection = (selectedRowKeys, selectedRows) => {
    this.setState({
      selectedRowKeys,
      selectedServers: selectedRows,
    });
  };

  handleImportSelected = async () => {
    const { selectedServers } = this.state;
    const { locale = {} } = this.props;

    if (selectedServers.length === 0) {
      Message.warning(locale.selectServers || 'Please select servers to import');
      return;
    }

    this.setState({ loading: true });

    try {
      const namespaceId = window.nownamespace || 'public';
      const importPromises = selectedServers.map(server =>
        this.importSingleServer(server, namespaceId)
      );

      const results = await Promise.allSettled(importPromises);

      let successCount = 0;
      let failCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to import ${selectedServers[index].name}:`, result.reason);
        }
      });

      if (successCount > 0) {
        Message.success(
          `${locale.importSuccess || 'Import Success'}: ${successCount} ${locale.servers ||
            'servers'}`
        );
      }

      if (failCount > 0) {
        Message.error(
          `${locale.importFailed || 'Import Failed'}: ${failCount} ${locale.servers || 'servers'}`
        );
      }

      if (this.props.onImportSuccess) {
        this.props.onImportSuccess(
          selectedServers.filter((_, index) => results[index].status === 'fulfilled')
        );
      }

      this.handleCancel();
    } catch (error) {
      Message.error(locale.importFailed || 'Import Failed');
      console.error('Import error:', error);
    } finally {
      this.setState({ loading: false });
    }
  };

  importSingleServer = async (server, namespaceId) => {
    // 根据server数据构建MCP服务器参数
    const mcpServerId = `${server.id}`;

    // 构建serverSpecification - 参考NewMcpServer的格式
    const serverSpec = {
      protocol: 'stdio',
      frontProtocol: 'stdio', // 默认使用stdio协议
      name: server.name,
      description: server.description || `Imported from file: ${server.name}`,
      versionDetail: {
        version: server.version_detail?.version || '1.0.0',
        is_latest: true,
      },
      enabled: true,
    };

    // 处理packages数据，转换为localServerConfig和packages格式
    if (server.packages && server.packages.length > 0) {
      const localServerConfig = this.convertPackagesToLocalServerConfig(
        server.packages,
        server.name
      );
      serverSpec.localServerConfig = localServerConfig;

      // 同时设置packages字段
      const packages = this.convertToPackagesFormat(server.packages);
      if (packages && packages.length > 0) {
        serverSpec.packages = packages;
      }
    } else {
      serverSpec.localServerConfig = JSON.parse(server.localConfig) || {};
      serverSpec.packages = this.convertServerConfigToPackages(serverSpec.localServerConfig);
    }

    // 构建toolSpecification - 如果有工具信息
    const toolSpec = {
      tools: server.tools ? JSON.parse(server.tools) : [], // 从文件导入的服务器通常没有预定义的工具
      securitySchemes: [],
    };

    // 构建请求参数 - 参考NewMcpServer的格式
    const params = {
      id: mcpServerId,
      serverSpecification: JSON.stringify(serverSpec),
      toolSpecification: JSON.stringify(toolSpec),
    };

    const result = await request({
      url: 'v3/console/ai/mcp',
      method: 'post',
      data: params,
    });

    if (result.code !== 0) {
      throw new Error(result.message || 'Failed to import server');
    }

    return result;
  };

  // 将packages转换为localServerConfig格式
  convertPackagesToLocalServerConfig = (packages, serverName) => {
    const mcpServers = {};

    packages.forEach((pkg, index) => {
      const serverKey = packages.length === 1 ? serverName : `${serverName}-${index + 1}`;

      const serverConfig = {
        description: pkg.description || serverName,
      };

      // 处理运行时参数，构建command和args
      const args = [];

      // 根据不同的注册表类型设置默认命令
      if (pkg.registry_name === 'npm' || pkg.registry_name === 'pypi') {
        if (pkg.registry_name === 'npm') {
          serverConfig.command = 'npx';
          args.push('-y');
        } else {
          serverConfig.command = 'python';
          args.push('-m');
        }
      } else {
        serverConfig.command = pkg.registry_name || 'npx';
      }

      // 添加包名和版本
      if (pkg.name) {
        if (pkg.version && pkg.version !== 'latest') {
          args.push(`${pkg.name}@${pkg.version}`);
        } else {
          args.push(pkg.name);
        }
      }

      // 处理runtime_arguments
      if (pkg.runtime_arguments && Array.isArray(pkg.runtime_arguments)) {
        pkg.runtime_arguments.forEach(arg => {
          args.push(...this.processArgument(arg));
        });
      }

      // 处理package_arguments
      if (pkg.package_arguments && Array.isArray(pkg.package_arguments)) {
        pkg.package_arguments.forEach(arg => {
          args.push(...this.processArgument(arg));
        });
      }

      serverConfig.args = args;

      // 处理环境变量
      const env = {};
      if (pkg.environment_variables && Array.isArray(pkg.environment_variables)) {
        pkg.environment_variables.forEach(envVar => {
          if (envVar.name) {
            env[envVar.name] = envVar.value || envVar.default || `<${envVar.name}>`;
          }
        });
      }
      serverConfig.env = env;

      mcpServers[serverKey] = serverConfig;
    });

    return { mcpServers };
  };

  // 处理单个参数
  processArgument = arg => {
    if (!arg || !arg.type) {
      return [];
    }

    const result = [];

    switch (arg.type) {
      case 'positional':
        if (arg.value) {
          result.push(arg.value);
        } else if (arg.default) {
          result.push(arg.default);
        } else if (arg.value_hint) {
          result.push(`<${arg.value_hint}>`);
        }
        break;

      case 'named':
        if (arg.name) {
          if (arg.value) {
            if (arg.value === true || arg.value === 'true') {
              result.push(arg.name); // 布尔标志
            } else {
              result.push(`${arg.name}=${arg.value}`);
            }
          } else if (arg.default) {
            if (arg.default === true || arg.default === 'true') {
              result.push(arg.name);
            } else {
              result.push(`${arg.name}=${arg.default}`);
            }
          } else {
            result.push(`${arg.name}=<value>`);
          }
        }
        break;

      default:
        if (arg.value) {
          result.push(arg.value);
        } else if (arg.default) {
          result.push(arg.default);
        }
        break;
    }

    return result;
  };

  // 转换为packages格式（用于serverSpec.packages字段）
  convertToPackagesFormat = packages => {
    return packages.map(pkg => ({
      registry_name: pkg.registry_name,
      name: pkg.name,
      version: pkg.version || 'latest',
      description: pkg.description,
      runtime_arguments: pkg.runtime_arguments || [],
      package_arguments: pkg.package_arguments || [],
      environment_variables: pkg.environment_variables || [],
    }));
  };

  // 将serverConfig转换为packages格式（参考NewMcpServer的实现）
  convertServerConfigToPackages = serverConfig => {
    console.log('Converting serverConfig to packages:', serverConfig);
    if (!serverConfig || !serverConfig.mcpServers) {
      return [];
    }

    const packages = [];

    Object.entries(serverConfig.mcpServers).forEach(([serverName, config]) => {
      if (!config.command) {
        return; // 跳过没有 command 的配置
      }

      // 解析命令行，支持两种格式：
      // 1. command + args 分离的格式
      // 2. command 包含完整命令行的格式
      let parsedCommand, parsedArgs;

      if (config.args && Array.isArray(config.args)) {
        // 格式1：command 和 args 分离
        parsedCommand = config.command;
        parsedArgs = config.args;
      } else {
        // 格式2：command 包含完整命令行，需要解析
        const commandParts = this.parseCommandLine(config.command);
        parsedCommand = commandParts.command;
        parsedArgs = commandParts.args;
      }

      const pkg = {
        registry_name: this.inferRegistryType(parsedCommand),
        name: this.extractPackageNameFromArgs(parsedArgs, parsedCommand),
        version: this.extractPackageVersionFromArgs(parsedArgs),
      };

      // 处理 runtime hint 和 runtime arguments
      if (parsedCommand && parsedCommand !== pkg.name) {
        pkg.runtime_hint = parsedCommand;

        // 从 args 中提取 runtime_arguments 和 package_arguments
        if (parsedArgs && Array.isArray(parsedArgs)) {
          const { runtimeArgs, packageArgs } = this.separateArguments(parsedArgs, pkg.name);

          if (runtimeArgs.length > 0) {
            pkg.runtime_arguments = runtimeArgs.map(arg => ({
              type: 'positional',
              value: arg,
              format: 'string',
            }));
          }

          if (packageArgs.length > 0) {
            pkg.package_arguments = packageArgs.map(arg => ({
              type: 'positional',
              value: arg,
              format: 'string',
            }));
          }
        }
      } else if (parsedArgs && Array.isArray(parsedArgs)) {
        // 如果 command 就是包名，所有 args 都是 package_arguments
        pkg.package_arguments = parsedArgs.map(arg => ({
          type: 'positional',
          value: arg,
          format: 'string',
        }));
      }

      // 处理环境变量
      if (config.env && typeof config.env === 'object') {
        pkg.environment_variables = Object.entries(config.env).map(([name, value]) => ({
          name: name,
          value: value,
          format: 'string',
        }));
      }

      packages.push(pkg);
    });

    return packages;
  };

  // 解析完整的命令行
  parseCommandLine = commandLine => {
    if (!commandLine || typeof commandLine !== 'string') {
      return { command: '', args: [] };
    }

    // 简单的命令行解析，处理空格分隔的参数
    // 支持引号包围的参数（虽然这个例子中没有用到）
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < commandLine.length; i++) {
      const char = commandLine[i];

      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes && char === ' ') {
        if (current.trim()) {
          parts.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return {
      command: parts[0] || '',
      args: parts.slice(1),
    };
  };

  // 从参数中提取包名
  extractPackageNameFromArgs = (args, command) => {
    if (args && Array.isArray(args) && args.length > 0) {
      // 查找第一个看起来像包名的参数
      for (const arg of args) {
        // 跳过常见的标志参数
        if (arg.startsWith('-')) {
          continue;
        }
        // 跳过 URL 参数
        if (arg.startsWith('http://') || arg.startsWith('https://')) {
          continue;
        }
        // 如果参数包含 @ 或 / 或看起来像包名，就认为是包名
        if (arg.includes('@') || arg.includes('/') || arg.match(/^[a-zA-Z0-9][\w.-]*$/)) {
          // 如果包含版本号(@version)，提取包名部分
          if (arg.includes('@') && arg.split('@').length > 1) {
            const parts = arg.split('@');
            // 如果最后一部分看起来像版本号，返回除了版本的部分
            const lastPart = parts[parts.length - 1];
            if (lastPart.match(/^\d+\.\d+/)) {
              return parts.slice(0, -1).join('@');
            }
          }
          return arg;
        }
      }
    }

    // 如果没找到合适的包名，使用 command 作为包名
    return command || 'unknown-package';
  };

  // 从参数中提取包版本
  extractPackageVersionFromArgs = args => {
    if (args && Array.isArray(args)) {
      // 查找版本信息
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        // 检查是否有 @version 格式
        if (arg.includes('@') && arg.split('@').length > 1) {
          const parts = arg.split('@');
          const version = parts[parts.length - 1];
          if (version.match(/^\d+\.\d+\.\d+/)) {
            return version;
          }
        }
        // 检查下一个参数是否是版本号
        if ((arg === '--version' || arg === '-v') && i + 1 < args.length) {
          const nextArg = args[i + 1];
          if (nextArg.match(/^\d+\.\d+\.\d+/)) {
            return nextArg;
          }
        }
      }
    }

    return 'latest'; // 默认版本
  };

  // 推断注册表类型
  inferRegistryType = command => {
    if (!command) return 'npm';

    // 如果 command 包含空格，取第一个词作为实际命令
    const actualCommand = command.split(' ')[0];

    const registryMap = {
      npm: 'npm',
      npx: 'npm',
      yarn: 'npm',
      pnpm: 'npm',
      pip: 'pypi',
      python: 'pypi',
      uvx: 'pypi',
      uv: 'pypi',
      dotnet: 'nuget',
      dnx: 'nuget',
      docker: 'docker',
      java: 'maven',
      mvn: 'maven',
      gradle: 'maven',
    };

    return registryMap[actualCommand] || 'npm'; // 默认为 npm
  };

  // 分离 runtime arguments 和 package arguments
  separateArguments = (args, packageName) => {
    const runtimeArgs = [];
    const packageArgs = [];

    let foundPackage = false;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (!foundPackage) {
        // 在找到包名之前的都是 runtime arguments
        if (
          arg === packageName ||
          arg.includes(packageName) ||
          // 处理带版本号的情况：如果arg包含@且包名匹配
          (arg.includes('@') && arg.startsWith(packageName + '@'))
        ) {
          foundPackage = true;
          // 如果包名包含额外信息（如版本），整个参数都视为 runtime argument
          if (arg !== packageName) {
            runtimeArgs.push(arg);
          }
        } else {
          runtimeArgs.push(arg);
        }
      } else {
        // 找到包名之后的都是 package arguments
        packageArgs.push(arg);
      }
    }

    return { runtimeArgs, packageArgs };
  };

  handleFileChange = async fileList => {
    this.setState({ fileList });

    if (fileList.length > 0) {
      const { locale = {} } = this.props;
      this.setState({ loading: true });

      try {
        const file = fileList[0].originFileObj || fileList[0];
        const fileContent = await this.readFileContent(file);

        let serverData;
        try {
          serverData = JSON.parse(fileContent);
        } catch (error) {
          Message.error(
            locale.invalidFileFormat || 'Invalid file format. Please upload a valid JSON file.'
          );
          this.setState({ loading: false });
          return;
        }

        // 使用新的数据处理方法
        const processedServers = this.processFileData(serverData);

        // 为卡片显示转换数据格式
        const displayServers = processedServers.map(server => ({
          ...server,
          creator: server.repository?.source || 'file',
          category: server.packages?.[0]?.registry_name || 'unknown',
          version: server.version_detail?.version || '1.0.0',
          createdAt: server.version_detail?.release_date || new Date().toISOString(),
        }));

        this.setState({
          fileServers: displayServers,
          fileTotalCount: displayServers.length,
          fileStep: 'select',
          fileCurrentPage: 1,
          fileSelectedServers: [],
          fileSelectedRowKeys: [],
          loading: false,
        });
      } catch (error) {
        console.error('File processing error:', error);
        Message.error(error.message || locale.fileReadFailed || 'Failed to read file');
        this.setState({ loading: false });
      }
    } else {
      // 清空文件相关状态
      this.setState({
        fileServers: [],
        fileTotalCount: 0,
        fileStep: 'upload',
        fileSelectedServers: [],
        fileSelectedRowKeys: [],
      });
    }
  };

  handleFileImport = async () => {
    const { fileSelectedServers } = this.state;
    const { locale = {} } = this.props;

    if (fileSelectedServers.length === 0) {
      Message.warning(locale.selectServers || 'Please select servers to import');
      return;
    }

    this.setState({ loading: true });

    try {
      const namespaceId = window.nownamespace || 'public';
      const importPromises = fileSelectedServers.map(server =>
        // 直接使用服务器对象，不需要原始数据包装
        this.importSingleServer(server, namespaceId)
      );

      const results = await Promise.allSettled(importPromises);

      let successCount = 0;
      let failCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to import ${fileSelectedServers[index].name}:`, result.reason);
        }
      });

      if (successCount > 0) {
        Message.success(
          `${locale.importSuccess || 'Import Success'}: ${successCount} ${locale.servers ||
            'servers'}`
        );
      }

      if (failCount > 0) {
        Message.error(
          `${locale.importFailed || 'Import Failed'}: ${failCount} ${locale.servers || 'servers'}`
        );
      }

      if (this.props.onImportSuccess) {
        this.props.onImportSuccess(
          fileSelectedServers.filter((_, index) => results[index].status === 'fulfilled')
        );
      }

      this.handleCancel();
    } catch (error) {
      Message.error(locale.importFailed || 'Import Failed');
      console.error('Import error:', error);
    } finally {
      this.setState({ loading: false });
    }
  };

  // 处理文件上传后的解析结果
  processFileData = fileData => {
    if (!fileData || typeof fileData !== 'object') {
      throw new Error('Invalid file format: expected JSON object');
    }

    // 如果文件直接包含服务器数组
    if (Array.isArray(fileData)) {
      return fileData.map((server, index) => ({
        ...server,
        id: server.id || `server_${index}`,
        name: server.name || `Server ${index + 1}`,
      }));
    }

    // 如果文件包含servers字段
    if (fileData.servers && Array.isArray(fileData.servers)) {
      return fileData.servers.map((server, index) => ({
        ...server,
        id: server.id || `server_${index}`,
        name: server.name || `Server ${index + 1}`,
      }));
    }

    // 如果文件只包含一个服务器对象
    if (fileData.name || fileData.packages) {
      return [
        {
          ...fileData,
          id: fileData.id || 'server_0',
          name: fileData.name || 'Imported Server',
        },
      ];
    }

    throw new Error('Invalid file format: no servers found');
  };

  readFileContent = file => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = e => reject(e);
      reader.readAsText(file);
    });
  };

  handleCancel = () => {
    this.setState({
      activeTab: 'public',
      selectedServers: [],
      selectedRowKeys: [],
      fileList: [],
      currentPage: 1,
      totalCount: 0,
      // 重置文件导入相关状态
      fileServers: [],
      fileSelectedServers: [],
      fileSelectedRowKeys: [],
      fileCurrentPage: 1,
      fileTotalCount: 0,
      fileStep: 'upload',
    });

    if (this.props.onCancel) {
      this.props.onCancel();
    }
  };

  handlePageChange = page => {
    this.loadPublicServers(page);
  };

  handleFilePageChange = page => {
    this.setState({ fileCurrentPage: page });
  };

  handleFileServerSelection = (selectedRowKeys, selectedRows) => {
    this.setState({
      fileSelectedRowKeys: selectedRowKeys,
      fileSelectedServers: selectedRows,
    });
  };

  toggleFileServerSelection = server => {
    const { fileSelectedRowKeys, fileSelectedServers } = this.state;
    const isSelected = fileSelectedRowKeys.includes(server.id);

    if (isSelected) {
      this.setState({
        fileSelectedRowKeys: fileSelectedRowKeys.filter(key => key !== server.id),
        fileSelectedServers: fileSelectedServers.filter(s => s.id !== server.id),
      });
    } else {
      this.setState({
        fileSelectedRowKeys: [...fileSelectedRowKeys, server.id],
        fileSelectedServers: [...fileSelectedServers, server],
      });
    }
  };

  // 返回上传步骤
  handleBackToUpload = () => {
    this.setState({
      fileStep: 'upload',
      fileList: [],
      fileServers: [],
      fileSelectedServers: [],
      fileSelectedRowKeys: [],
    });
  };

  toggleServerSelection = server => {
    const { selectedRowKeys, selectedServers } = this.state;
    const isSelected = selectedRowKeys.includes(server.id);

    if (isSelected) {
      this.setState({
        selectedRowKeys: selectedRowKeys.filter(key => key !== server.id),
        selectedServers: selectedServers.filter(s => s.id !== server.id),
      });
    } else {
      this.setState({
        selectedRowKeys: [...selectedRowKeys, server.id],
        selectedServers: [...selectedServers, server],
      });
    }
  };

  renderServerCard = server => {
    const { selectedRowKeys } = this.state;
    const { locale = {} } = this.props;
    const isSelected = selectedRowKeys.includes(server.id);

    return (
      <Card
        key={server.id}
        style={{
          marginBottom: 12,
          cursor: 'pointer',
          border: isSelected ? '2px solid #1890ff' : '1px solid rgba(230, 230, 230, 0.4)',
          backgroundColor: isSelected ? '#f6ffed' : 'rgba(250, 250, 250, 0.7)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03)',
          borderRadius: '8px',
          transition: 'all 0.3s ease',
        }}
        onClick={() => this.toggleServerSelection(server)}
        bodyStyle={{ padding: 16 }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow =
            '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow =
            '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <Checkbox
            checked={isSelected}
            style={{ marginRight: 12, marginTop: 4 }}
            onChange={() => {}} // Handled by card click
          />

          <div style={{ flex: 1 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 'bold', color: '#1890ff' }}>
                {server.name}
              </h4>
              {server.hot && (
                <Tag size="small" color="red" style={{ marginLeft: 8 }}>
                  HOT
                </Tag>
              )}
              {server.category && (
                <Tag size="small" style={{ marginLeft: 8 }}>
                  {server.category}
                </Tag>
              )}
            </div>

            {/* Creator and stats */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, color: '#666' }}>
              <Icon type="account" style={{ marginRight: 4 }} />
              <span style={{ marginRight: 16 }}>{server.creator || '--'}</span>
              <Icon type="eye" style={{ marginRight: 4 }} />
              <span style={{ marginRight: 16 }}>
                {server.views || 0} {locale.views || 'views'}
              </span>
              <Icon type="calendar" style={{ marginRight: 4 }} />
              <span>{this.formatDate(server.createdAt)}</span>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 8 }}>
              <Balloon.Tooltip
                trigger={
                  <div
                    style={{
                      color: '#666',
                      lineHeight: '1.5',
                      maxHeight: '3em',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                    }}
                  >
                    {server.description ||
                      server.description_zh ||
                      locale.noDescription ||
                      'No description available'}
                  </div>
                }
                align="t"
              >
                {server.description || server.description_zh}
              </Balloon.Tooltip>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  renderFileServerCard = server => {
    const { fileSelectedRowKeys } = this.state;
    const { locale = {} } = this.props;
    const isSelected = fileSelectedRowKeys.includes(server.id);

    return (
      <Card
        key={server.id}
        style={{
          marginBottom: 12,
          cursor: 'pointer',
          border: isSelected ? '2px solid #1890ff' : '1px solid rgba(230, 230, 230, 0.4)',
          backgroundColor: isSelected ? '#f6ffed' : 'rgba(250, 250, 250, 0.7)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03)',
          borderRadius: '8px',
          transition: 'all 0.3s ease',
        }}
        onClick={() => this.toggleFileServerSelection(server)}
        bodyStyle={{ padding: 16 }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow =
            '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow =
            '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <Checkbox
            checked={isSelected}
            style={{ marginRight: 12, marginTop: 4 }}
            onChange={() => {}} // Handled by card click
          />

          <div style={{ flex: 1 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 'bold', color: '#1890ff' }}>
                {server.name}
              </h4>
              <Tag size="small" style={{ marginLeft: 8, backgroundColor: '#f0f8ff' }}>
                {locale.fromFile || 'From File'}
              </Tag>
              {server.category && (
                <Tag size="small" style={{ marginLeft: 8 }}>
                  {server.category}
                </Tag>
              )}
            </div>

            {/* Creator and stats */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, color: '#666' }}>
              <Icon type="account" style={{ marginRight: 4 }} />
              <span style={{ marginRight: 16 }}>{server.creator || '--'}</span>
              <Icon type="calendar" style={{ marginRight: 4 }} />
              <span style={{ marginRight: 16 }}>v{server.version}</span>
              {server.packages && server.packages.length > 0 && (
                <>
                  <Icon type="code" style={{ marginRight: 4 }} />
                  <span>
                    {server.packages.length} {locale.packages || 'packages'}
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 8 }}>
              <Balloon.Tooltip
                trigger={
                  <div
                    style={{
                      color: '#666',
                      lineHeight: '1.5',
                      maxHeight: '3em',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      wordBreak: 'break-word',
                    }}
                  >
                    {server.description || locale.noDescription || 'No description available'}
                  </div>
                }
                align="t"
              >
                {server.description}
              </Balloon.Tooltip>
            </div>

            {/* Package details */}
            {server.packages && server.packages.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                  {locale.packages || 'Packages'}:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {server.packages.slice(0, 3).map((pkg, index) => (
                    <Tag
                      key={index}
                      size="small"
                      style={{
                        backgroundColor: this.getRegistryColor(pkg.registry_name),
                        color: 'white',
                        border: 'none',
                        fontSize: '11px',
                      }}
                    >
                      {pkg.name}@{pkg.version}
                    </Tag>
                  ))}
                  {server.packages.length > 3 && (
                    <Tag size="small" style={{ backgroundColor: '#f5f5f5', color: '#666' }}>
                      +{server.packages.length - 3} {locale.more || 'more'}
                    </Tag>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // 获取注册表类型对应的颜色
  getRegistryColor = registryType => {
    const colors = {
      npm: '#cb3837',
      docker: '#2496ed',
      pip: '#3776ab',
      pypi: '#3776ab',
      uv: '#6b73ff',
      dnx: '#512bd4',
    };
    return colors[registryType] || '#666666';
  };

  formatDate = dateString => {
    if (!dateString) return '--';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return '--';
    }
  };

  renderPublicRegistryTab = () => {
    const { locale = {} } = this.props;
    const {
      loading,
      publicServers,
      selectedRowKeys,
      currentPage,
      pageSize,
      totalCount,
    } = this.state;

    return (
      <div>
        <Loading visible={loading} style={{ display: 'block' }}>
          <div style={{ minHeight: 500 }}>
            {/* Toolbar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                marginBottom: 16,
                padding: '0 4px',
              }}
            >
              <div style={{ color: '#666' }}>
                {totalCount > 0 ? (
                  <span>
                    {locale.total || 'Total'} {totalCount} {locale.servers || 'servers'}
                    {selectedRowKeys.length > 0 && (
                      <span style={{ marginLeft: 8, color: '#1890ff' }}>
                        ({selectedRowKeys.length} {locale.selected || 'selected'})
                      </span>
                    )}
                  </span>
                ) : (
                  <span>{locale.noServersFound || 'No servers found'}</span>
                )}
              </div>
            </div>

            {/* Content */}
            {publicServers.length === 0 && !loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                <Icon type="inbox" size="xl" style={{ marginBottom: 16 }} />
                <div>{locale.noServersFound || 'No servers found'}</div>
              </div>
            ) : (
              <div>
                <div>{publicServers.map(server => this.renderServerCard(server))}</div>

                {/* Pagination */}
                {totalCount > pageSize && (
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <Pagination
                      current={currentPage}
                      total={totalCount}
                      pageSize={pageSize}
                      onChange={this.handlePageChange}
                      showSizeChanger={false}
                      hideOnSinglePage={false}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Loading>
      </div>
    );
  };

  renderFileImportTab = () => {
    const { locale = {} } = this.props;
    const {
      fileList,
      fileStep,
      fileServers,
      fileSelectedRowKeys,
      fileCurrentPage,
      fileTotalCount,
      loading,
    } = this.state;
    const { pageSize } = this.state;

    if (fileStep === 'upload') {
      // 第一步：上传文件
      return (
        <div style={{ padding: '40px 20px' }}>
          <Upload
            listType="picture-card"
            accept=".json"
            fileList={fileList}
            onChange={this.handleFileChange}
            action=""
            beforeUpload={() => false}
            dragable
            style={{
              border: '2px dashed #ccc',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#f9f9f9',
              transition: 'all 0.3s ease',
              textAlign: 'center',
              width: '100%',
            }}
          >
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }}>📁</div>
              <p style={{ color: '#595959', fontSize: '16px', marginBottom: '8px' }}>
                {locale.dragAndDropFileHereOrClickToSelect ||
                  'Drag and drop file here or Click to select'}
              </p>
              <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
                {locale.supportJsonFilesOnly ||
                  'Support for a single upload. Only accept .json files.'}
              </p>
            </div>
          </Upload>
        </div>
      );
    } else {
      // 第二步：选择服务器
      const startIndex = (fileCurrentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const currentFileServers = fileServers.slice(startIndex, endIndex);

      return (
        <div>
          <Loading visible={loading} style={{ display: 'block' }}>
            <div style={{ minHeight: 500 }}>
              {/* Toolbar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  padding: '0 4px',
                }}
              >
                <div style={{ color: '#666' }}>
                  {fileTotalCount > 0 ? (
                    <span>
                      {locale.total || 'Total'} {fileTotalCount} {locale.servers || 'servers'}
                      {fileSelectedRowKeys.length > 0 && (
                        <span style={{ marginLeft: 8, color: '#1890ff' }}>
                          ({fileSelectedRowKeys.length} {locale.selected || 'selected'})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>{locale.noServersFound || 'No servers found'}</span>
                  )}
                </div>

                <Button size="small" onClick={this.handleBackToUpload}>
                  <Icon type="arrow-left" style={{ marginRight: 4 }} />
                  {locale.backToUpload || 'Back to Upload'}
                </Button>
              </div>

              {/* Content */}
              {fileServers.length === 0 && !loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
                  <Icon type="inbox" size="xl" style={{ marginBottom: 16 }} />
                  <div>{locale.noServersFound || 'No servers found'}</div>
                </div>
              ) : (
                <div>
                  <div>{currentFileServers.map(server => this.renderFileServerCard(server))}</div>

                  {/* Pagination */}
                  {fileTotalCount > pageSize && (
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                      <Pagination
                        current={fileCurrentPage}
                        total={fileTotalCount}
                        pageSize={pageSize}
                        onChange={this.handleFilePageChange}
                        showSizeChanger={false}
                        hideOnSinglePage={false}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Loading>
        </div>
      );
    }
  };

  render() {
    const { visible, locale = {} } = this.props;
    const { activeTab, selectedServers, fileList, fileStep, fileSelectedServers } = this.state;

    // 构建 footer 按钮
    const footerActions = [
      <Button key="cancel" onClick={this.handleCancel} style={{ marginRight: 16 }}>
        {locale.cancel || 'Cancel'}
      </Button>,
      activeTab === 'public' ? (
        <Button
          key="import"
          type="primary"
          disabled={selectedServers.length === 0}
          onClick={this.handleImportSelected}
        >
          {locale.importSelected || 'Import Selected'}
          {selectedServers.length > 0 && ` (${selectedServers.length})`}
        </Button>
      ) : // 文件导入的按钮逻辑
      fileStep === 'upload' ? (
        <Button
          key="next"
          type="primary"
          disabled={fileList.length === 0}
          onClick={() => {}} // 文件上传后自动进入下一步
        >
          {locale.next || 'Next'}
        </Button>
      ) : (
        <Button
          key="import"
          type="primary"
          disabled={fileSelectedServers.length === 0}
          onClick={this.handleFileImport}
        >
          {locale.importSelected || 'Import Selected'}
          {fileSelectedServers.length > 0 && ` (${fileSelectedServers.length})`}
        </Button>
      ),
    ];

    return (
      <Dialog
        visible={visible}
        title={locale.importDialogTitle || 'Import MCP Server'}
        onCancel={this.handleCancel}
        onClose={this.handleCancel}
        footer={footerActions}
        style={{ width: 1000 }}
      >
        <Tab activeKey={activeTab} onChange={key => this.setState({ activeTab: key })}>
          <Tab.Item key="public" title={locale.publicRegistryTab || 'Public Registry'}>
            {this.renderPublicRegistryTab()}
          </Tab.Item>
          <Tab.Item key="file" title={locale.fileImportTab || 'File Import'}>
            {this.renderFileImportTab()}
          </Tab.Item>
        </Tab>
      </Dialog>
    );
  }
}

export default ImportMcpDialog;
