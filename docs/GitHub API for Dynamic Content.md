# GitHub API for Dynamic Content

Fetching repository content dynamically using the GitHub REST API.

---

## Use Case

Load file trees and content from a GitHub repository without a backend server. Perfect for:
- Static site generators
- Documentation browsers
- Knowledge management tools

---

## API Endpoints

### Get Repository Contents

```
GET https://api.github.com/repos/{owner}/{repo}/contents/{path}
```

Returns array of items with:
- `name` - File or folder name
- `path` - Full path in repo
- `type` - "file" or "dir"
- `sha` - Git blob hash

### Get Raw File Content

```
GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}
```

Returns raw file content (no API rate limits).

---

## Implementation

### Fetching Directory

```javascript
async fetchDirectory(path) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
}
```

### Handling Spaces in Paths

URL-encode each path segment separately:

```javascript
const encodedPath = path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
```

### Fetching Raw Content

```javascript
async fetchRawContent(path) {
    const encodedPath = path
        .split('/')
        .map(s => encodeURIComponent(s))
        .join('/');
    
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/${encodedPath}`;
    const response = await fetch(url);
    
    return response.text();
}
```

---

## Caching Strategy

Cache API responses to avoid repeated fetches:

```javascript
const cache = new Map();

async fetchWithCache(path) {
    if (cache.has(path)) {
        return cache.get(path);
    }
    
    const data = await fetchDirectory(path);
    cache.set(path, data);
    return data;
}
```

---

## Rate Limits

| Type | Limit |
|------|-------|
| Unauthenticated | 60 requests/hour |
| Authenticated | 5,000 requests/hour |
| Raw content | No limit |

**Tip:** Use raw.githubusercontent.com for file content to avoid API limits.

---

## Filtering Hidden Items

```javascript
const hiddenItems = ['.obsidian', '.DS_Store', '.gitignore'];

const visibleItems = items.filter(item => 
    !hiddenItems.includes(item.name) &&
    !item.name.startsWith('.')
);
```

---

## Error Handling

```javascript
try {
    const items = await fetchDirectory(path);
    renderItems(items);
} catch (error) {
    if (error.message.includes('404')) {
        showError('Folder not found');
    } else if (error.message.includes('403')) {
        showError('Rate limit exceeded');
    } else {
        showError('Failed to load content');
    }
}
```

---

## Related Notes

- [[Building a Knowledge Garden with D3]]
- [[Lazy Loading File Trees]]
- [[Markdown Rendering in JavaScript]]
