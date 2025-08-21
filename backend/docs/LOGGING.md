# Logging Documentation

## Overview

This application uses **Winston** for comprehensive logging with both console and file output. The logging system follows best practices including log rotation, structured JSON logging, and sensitive data sanitization.

## Log Files Structure

```
logs/
├── app-2025-08-21.log          # All application logs (debug, info, warn, error)
├── error-2025-08-21.log        # Error logs only
├── application-2025-08-21.log  # Important application events (warn+)
├── exceptions-2025-08-21.log   # Uncaught exceptions
└── rejections-2025-08-21.log   # Unhandled promise rejections
```

## Log Levels

- **DEBUG**: Detailed diagnostic information (development only)
- **INFO**: General application information
- **WARN**: Important warnings and application events
- **ERROR**: Error conditions and exceptions

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Minimum log level to output |
| `FILE_LOGGING` | `true` | Enable/disable file logging |
| `CONSOLE_LOGGING` | `true` | Enable/disable console logging |
| `LOG_DIR` | `logs` | Directory for log files |
| `LOG_MAX_SIZE` | `50m` | Maximum size per log file before rotation |
| `LOG_RETENTION_APP` | `14d` | Retention period for app logs |
| `LOG_RETENTION_ERROR` | `30d` | Retention period for error logs |
| `LOG_RETENTION_APPLICATION` | `7d` | Retention period for application logs |
| `LOG_RETENTION_EXCEPTIONS` | `30d` | Retention period for exception logs |

### Example Environment Configuration

```bash
# Development
LOG_LEVEL=debug
FILE_LOGGING=true
CONSOLE_LOGGING=true

# Production
LOG_LEVEL=info
FILE_LOGGING=true
CONSOLE_LOGGING=false
LOG_MAX_SIZE=100m
LOG_RETENTION_ERROR=60d
```

## Log Formats

### Console Output (Development)
```
2025-08-21T10:30:45.123Z [INFO] SlackService: Service initialized successfully {"channels": 4}
```

### File Output (JSON)
```json
{
  "timestamp": "2025-08-21T10:30:45.123Z",
  "level": "info",
  "logger": "SlackService",
  "message": "Service initialized successfully",
  "channels": 4
}
```

## Usage Examples

### Basic Logging
```typescript
import { Logger } from '@/utils/logger.js';

const logger = Logger.create('MyService');

logger.info('Service started');
logger.warn('Configuration warning', { config: 'value' });
logger.error('Operation failed', error, { userId: '123' });
```

### Child Loggers with Context
```typescript
const logger = Logger.create('UserService');
const userLogger = logger.child({ userId: '12345', operation: 'login' });

userLogger.info('User login started'); // Includes userId and operation in all logs
userLogger.error('Login failed', error);
```

## Security Features

### Sensitive Data Sanitization
The logger automatically sanitizes sensitive fields:
- `password`, `token`, `secret`, `key`
- `api_key`, `apikey`, `authorization`, `auth`
- `credential`, `credentials`

Sensitive values are replaced with `[REDACTED]` in all log outputs.

### Example
```typescript
logger.info('API call made', { 
  url: '/api/users', 
  apiKey: 'sk-1234567890' // Will be logged as "[REDACTED]"
});
```

## Log Rotation

- **Daily Rotation**: Log files rotate daily at midnight
- **Size-based**: Files rotate when they exceed the configured size
- **Automatic Cleanup**: Old logs are automatically deleted based on retention policy
- **Atomic Operations**: Log rotation doesn't interrupt logging

## Monitoring and Alerting

### Log File Locations
- Logs are stored in `/logs` directory relative to the application root
- Each log type has separate files for easy monitoring
- JSON format enables easy parsing by log aggregation tools

### Integration with External Tools
The structured JSON format is compatible with:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Splunk**
- **Datadog**
- **CloudWatch Logs**
- **Fluentd**

## Performance Considerations

- **Asynchronous Logging**: Winston handles I/O asynchronously
- **Buffered Writes**: File writes are buffered for performance
- **Log Level Filtering**: Debug logs are excluded in production
- **Rotation Overhead**: Minimal impact due to atomic operations

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure the application has write permissions to the log directory
2. **Disk Space**: Monitor disk usage as logs can accumulate quickly
3. **Log Rotation**: Check that old logs are being cleaned up according to retention policy

### Debug Mode
Set `LOG_LEVEL=debug` to see detailed diagnostic information:

```bash
export LOG_LEVEL=debug
pnpm start
```

### Disable File Logging (for testing)
```bash
export FILE_LOGGING=false
pnpm start
```

## Best Practices

1. **Use Appropriate Log Levels**: 
   - DEBUG for detailed diagnostic info
   - INFO for general application flow
   - WARN for important but non-critical issues
   - ERROR for error conditions

2. **Include Context**: Use child loggers or metadata to provide context
   ```typescript
   logger.info('Processing user request', { userId, action, timestamp });
   ```

3. **Avoid Sensitive Data**: The sanitizer helps, but avoid logging sensitive data entirely

4. **Use Structured Logging**: Include relevant metadata as objects rather than string concatenation

5. **Monitor Log Volume**: In high-traffic applications, be mindful of log volume and adjust levels accordingly

## Migration from Console Logging

The new logger maintains the same interface as the previous console-based logger:

```typescript
// Old way (still works)
logger.info('Message', { data: 'value' });

// New benefits (automatically applied)
// ✅ File rotation
// ✅ Structured JSON
// ✅ Sensitive data sanitization  
// ✅ Error tracking
// ✅ Performance optimization
```
