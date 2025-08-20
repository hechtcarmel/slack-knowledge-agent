import { Logger } from '@/utils/logger.js';
import { 
  ToolDefinition, 
  ToolFunction, 
  ToolExecutionResult, 
  ToolRegistry as IToolRegistry 
} from '../types.js';

export class ToolRegistry implements IToolRegistry {
  private logger = Logger.create('ToolRegistry');
  private tools = new Map<string, { definition: ToolDefinition; handler: ToolFunction }>();

  register(name: string, definition: ToolDefinition, handler: ToolFunction): void {
    if (this.tools.has(name)) {
      this.logger.warn(`Tool '${name}' is being overridden`);
    }

    this.tools.set(name, { definition, handler });
    this.logger.info(`Tool '${name}' registered successfully`, {
      description: definition.function.description,
      parameters: Object.keys(definition.function.parameters.properties || {})
    });
  }

  get(name: string): { definition: ToolDefinition; handler: ToolFunction } | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }

  async execute(name: string, params: any): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      const error = `Tool '${name}' not found`;
      this.logger.error(error);
      return {
        success: false,
        error
      };
    }

    const startTime = Date.now();
    this.logger.info(`Executing tool '${name}'`, { params });

    try {
      // Validate parameters against tool schema
      const validationResult = this.validateParameters(tool.definition, params);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Parameter validation failed: ${validationResult.error}`,
          metadata: { validationErrors: validationResult.errors }
        };
      }

      const result = await tool.handler(params);
      const executionTime = Date.now() - startTime;
      
      this.logger.info(`Tool '${name}' executed successfully`, {
        executionTime,
        success: result.success
      });

      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime,
          toolName: name
        }
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Tool '${name}' execution failed`, error as Error, {
        executionTime,
        params
      });

      return {
        success: false,
        error: `Tool execution failed: ${(error as Error).message}`,
        metadata: {
          executionTime,
          toolName: name,
          originalError: (error as Error).stack
        }
      };
    }
  }

  private validateParameters(definition: ToolDefinition, params: any): {
    valid: boolean;
    error?: string;
    errors?: string[];
  } {
    const errors: string[] = [];
    const schema = definition.function.parameters;
    const required = schema.required || [];

    // Check required parameters
    for (const requiredParam of required) {
      if (params[requiredParam] === undefined || params[requiredParam] === null) {
        errors.push(`Missing required parameter: ${requiredParam}`);
      }
    }

    // Check parameter types (basic validation)
    const properties = schema.properties || {};
    for (const [paramName, paramValue] of Object.entries(params)) {
      const paramSchema = properties[paramName];
      if (paramSchema && paramSchema.type) {
        const actualType = typeof paramValue;
        const expectedType = paramSchema.type;
        
        if (expectedType === 'array' && !Array.isArray(paramValue)) {
          errors.push(`Parameter '${paramName}' should be an array`);
        } else if (expectedType !== 'array' && actualType !== expectedType) {
          errors.push(`Parameter '${paramName}' should be of type ${expectedType}, got ${actualType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  clear(): void {
    const toolCount = this.tools.size;
    this.tools.clear();
    this.logger.info(`Cleared ${toolCount} tools from registry`);
  }

  size(): number {
    return this.tools.size;
  }
}