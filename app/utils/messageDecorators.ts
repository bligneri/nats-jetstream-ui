export interface MessageDecorator {
  // Pattern to match subjects (e.g., "commands.dlq.*", "commands.history.*")
  pattern: string;
  // Important fields to highlight at the top
  highlightFields: string[];
  // Custom labels for fields
  fieldLabels?: Record<string, string>;
  // Color scheme
  color?: string;
}

// Cache for decorators loaded from API
let decoratorsCache: MessageDecorator[] | null = null;

export async function loadDecorators(serverId?: number, forceReload = false): Promise<MessageDecorator[]> {
  if (decoratorsCache && !forceReload && !serverId) {
    return decoratorsCache;
  }

  try {
    const url = serverId ? `/api/decorators?serverId=${serverId}` : '/api/decorators';
    const decorators = await $fetch<MessageDecorator[]>(url);
    console.log(`📋 Loaded decorators for server ${serverId || 'default'}:`, decorators.length);
    if (!serverId) {
      decoratorsCache = decorators;
    }
    return decorators;
  } catch (error) {
    console.warn('Failed to load decorators, using empty config');
    const emptyDecorators: MessageDecorator[] = [];
    if (!serverId) {
      decoratorsCache = emptyDecorators;
    }
    return emptyDecorators;
  }
}

export function clearDecoratorsCache() {
  decoratorsCache = null;
}

export function getDecoratorForSubject(
  subject: string,
  decorators: MessageDecorator[]
): MessageDecorator | null {
  for (const decorator of decorators) {
    const pattern = decorator.pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '[^.]+')
      .replace(/>/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(subject)) {
      return decorator;
    }
  }
  return null;
}

export function extractHighlightedFields(
  data: any,
  decorator: MessageDecorator | null
): Record<string, any> {
  if (!decorator || !decorator.highlightFields) return {};

  const highlighted: Record<string, any> = {};
  for (const field of decorator.highlightFields) {
    if (data && field in data) {
      const value = data[field];
      // Handle SQL NullString/NullInt pattern: { String: "value", Valid: true }
      if (value && typeof value === 'object' && 'String' in value && 'Valid' in value) {
        highlighted[field] = value.Valid ? value.String : null;
      } else {
        highlighted[field] = value;
      }
    }
  }
  return highlighted;
}

export function syntaxHighlightJson(json: string): string {
  // Simple JSON syntax highlighting with HTML
  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
      let cls = 'json-string';
      if (/:$/.test(match)) {
        cls = 'json-key';
        match = match.slice(0, -1); // Remove trailing :
        return `<span class="${cls}">${match}</span>:`;
      }
      return `<span class="${cls}">${match}</span>`;
    })
    .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
    .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
    .replace(/\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '<span class="json-number">$1</span>');
}
