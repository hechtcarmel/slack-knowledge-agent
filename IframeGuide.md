# Iframe Embed Guide - Slack Knowledge Agent

This guide explains how to embed the Slack Knowledge Agent chat interface into your own website or application using iframes.

## Quick Start

Add this HTML to your webpage to embed the chat:

```html
<iframe 
  src="https://your-slack-agent.com/?embed=true&channels=general,support"
  width="800" 
  height="600"
  style="border: 1px solid #e2e8f0; border-radius: 8px;"
  title="Slack Knowledge Agent">
</iframe>
```

## URL Parameters

The iframe embed mode is controlled via URL query parameters:

### Required Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `embed` | `true` | **Required** - Enables iframe embed mode |
| `channels` | `channel1,channel2,channel3` | **Required** - Comma-separated list of channel IDs or names |

### Optional Parameters

| Parameter | Default | Options | Description |
|-----------|---------|---------|-------------|
| `theme` | System default | `light`, `dark`, `system` | Override the theme |
| `title` | None | Any string | Custom title shown in the header |
| `readonly` | `false` | `true`, `false` | Enable/disable message sending |

## Examples

### Basic Single Channel
```html
<iframe src="https://your-slack-agent.com/?embed=true&channels=general"
        width="600" height="500"></iframe>
```

### Multiple Channels with Custom Title
```html
<iframe src="https://your-slack-agent.com/?embed=true&channels=general,support,dev-team&title=Help%20Center"
        width="800" height="600"></iframe>
```

### Dark Theme
```html
<iframe src="https://your-slack-agent.com/?embed=true&channels=general&theme=dark"
        width="800" height="600"></iframe>
```

### Read-Only Mode
```html
<iframe src="https://your-slack-agent.com/?embed=true&channels=general&readonly=true"
        width="800" height="600"></iframe>
```

## Channel Configuration

### Using Channel Names
You can specify channels by their display names:
```
?channels=general,dev-team,support
```

### Using Channel IDs
You can also use Slack channel IDs:
```
?channels=C1234567890,C0987654321
```

### Mixed Format
Both formats can be mixed:
```
?channels=general,C1234567890,support
```

## Responsive Design

The embedded chat automatically adapts to different screen sizes:

### Recommended Minimum Sizes
- **Mobile**: 320px width × 400px height
- **Tablet**: 500px width × 500px height  
- **Desktop**: 800px width × 600px height

### Responsive Iframe CSS
```css
.chat-iframe {
  width: 100%;
  height: 500px;
  max-width: 800px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

@media (max-width: 768px) {
  .chat-iframe {
    height: 400px;
  }
}
```

## Advanced Integration

### Dynamic Channel Selection
You can change channels dynamically by updating the iframe source:

```javascript
function updateChannels(channels) {
  const iframe = document.getElementById('chat-iframe');
  const baseUrl = 'https://your-slack-agent.com/';
  const params = new URLSearchParams({
    embed: 'true',
    channels: channels.join(','),
    title: 'Updated Chat'
  });
  iframe.src = `${baseUrl}?${params.toString()}`;
}

// Usage
updateChannels(['general', 'support']);
```

### Theme Switching
```javascript
function switchTheme(theme) {
  const iframe = document.getElementById('chat-iframe');
  const url = new URL(iframe.src);
  url.searchParams.set('theme', theme);
  iframe.src = url.toString();
}

// Usage
switchTheme('dark');
```

## CSS Styling Options

### Basic Styling
```css
.slack-chat-embed {
  border: 1px solid #d1d5db;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}
```

### Card-Style Embed
```css
.chat-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  padding: 8px;
}

.chat-card iframe {
  border: none;
  border-radius: 8px;
}
```

### Dark Mode Container
```css
@media (prefers-color-scheme: dark) {
  .chat-container {
    background: #1f2937;
    border: 1px solid #374151;
  }
}
```

## Common Integration Patterns

### Help Center Widget
```html
<div class="help-widget">
  <h3>Need Help?</h3>
  <p>Chat with our team using our Slack knowledge base:</p>
  <iframe 
    src="https://your-slack-agent.com/?embed=true&channels=support&title=Support%20Chat"
    width="100%" 
    height="500"
    style="border: 1px solid #e5e7eb; border-radius: 8px;">
  </iframe>
</div>
```

### Sidebar Integration
```html
<div class="sidebar-chat">
  <iframe 
    src="https://your-slack-agent.com/?embed=true&channels=general&theme=light"
    width="400" 
    height="600"
    style="border: none;">
  </iframe>
</div>
```

### Modal/Popup Integration
```html
<div id="chat-modal" class="modal">
  <div class="modal-content">
    <span class="close" onclick="closeModal()">&times;</span>
    <iframe 
      src="https://your-slack-agent.com/?embed=true&channels=support,general"
      width="800" 
      height="600"
      style="border: none; border-radius: 8px;">
    </iframe>
  </div>
</div>
```

## Security Considerations

### Content Security Policy (CSP)
If you use CSP headers, add the iframe source to your policy:

```
Content-Security-Policy: frame-src 'self' https://your-slack-agent.com;
```

### Same-Origin Policy
The embedded iframe runs in its own context and doesn't have access to your parent page's DOM or data.

### HTTPS Requirements
Always use HTTPS for both your site and the iframe source to ensure secure communication.

## Troubleshooting

### Common Issues

#### Iframe Not Loading
- Check that the URL is correct and accessible
- Verify CSP headers allow iframe loading
- Ensure the server supports iframe embedding

#### Channels Not Found
- Verify channel names/IDs are correct
- Ensure the Slack bot has access to specified channels
- Check that channels exist in your Slack workspace

#### Responsive Issues
- Use percentage-based widths: `width="100%"`
- Set appropriate min/max widths
- Test on different screen sizes

### Debug Mode
Add `debug=true` to the URL parameters to enable debug logging:
```
?embed=true&channels=general&debug=true
```

## Best Practices

### Performance
- Use appropriate iframe dimensions to avoid unnecessary scrollbars
- Consider lazy loading for iframes below the fold:
  ```html
  <iframe loading="lazy" src="..."></iframe>
  ```

### Accessibility
- Always include a descriptive `title` attribute
- Provide fallback content for screen readers:
  ```html
  <iframe title="Slack Knowledge Agent Chat">
    <p>Chat interface not available. Please visit our <a href="/contact">contact page</a>.</p>
  </iframe>
  ```

### User Experience
- Set reasonable default dimensions
- Consider the context where the chat will be used
- Test on different devices and screen sizes
- Provide clear instructions on how to use the chat

### SEO Considerations
- Iframe content is not indexed by search engines
- Consider providing alternative content or links
- Use descriptive titles and alt text

## Examples by Use Case

### Customer Support Page
```html
<section class="support-chat">
  <h2>Get Instant Help</h2>
  <p>Search our team's knowledge base and get answers from our Slack channels:</p>
  <iframe 
    src="https://your-slack-agent.com/?embed=true&channels=support,general&title=Customer%20Support"
    width="100%" 
    height="600"
    style="max-width: 1000px; border: 1px solid #ddd; border-radius: 12px;"
    title="Customer Support Chat">
  </iframe>
</section>
```

### Project Documentation
```html
<div class="project-help">
  <h3>Project Q&A</h3>
  <iframe 
    src="https://your-slack-agent.com/?embed=true&channels=project-alpha,dev-team&title=Project%20Alpha%20Help"
    width="800" 
    height="500"
    style="border: 2px solid #3b82f6; border-radius: 8px;"
    title="Project Alpha Help">
  </iframe>
</div>
```

### Internal Knowledge Base
```html
<div class="internal-kb">
  <h2>Team Knowledge Base</h2>
  <p>Search across all team channels for answers:</p>
  <iframe 
    src="https://your-slack-agent.com/?embed=true&channels=general,dev-team,design,marketing&title=Team%20Knowledge%20Base"
    width="100%" 
    height="700"
    style="border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
    title="Team Knowledge Base">
  </iframe>
</div>
```

## Support

If you encounter issues with the iframe integration:

1. Check the browser console for error messages
2. Verify all URL parameters are correctly formatted
3. Test with a simple example first
4. Ensure your Slack workspace is properly configured
5. Contact your system administrator for server-side issues

---

**Note**: Replace `https://your-slack-agent.com` with your actual Slack Knowledge Agent deployment URL in all examples.