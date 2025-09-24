# Knowledge Garden - Material Design 3

A minimalist, privacy-focused knowledge management interface built with Material Design 3 principles.

## 🎨 Design Philosophy

This knowledge garden transforms Obsidian notes into a professional, accessible web interface using Google's Material Design 3 (Material You) design system. The periwinkle and lavender color palette creates a calming, focused reading experience.

## ✨ Features

### Material Design 3 Implementation
- **Dynamic theming** with light/dark mode toggle
- **Semantic color system** using periwinkle/lavender palette
- **Typography scale** optimized for content readability
- **Elevation system** for visual hierarchy
- **Responsive layout** adapting to all screen sizes

### Privacy Protection
- **Client-side only** - no server-side data processing
- **Protected folders** (Career, Myself) excluded via .gitignore
- **Private content filtering** in JavaScript parser

### Enhanced Markdown Parsing
- **Marked.js integration** for proper GFM support
- **Wiki-style links** converted to internal navigation
- **Code syntax highlighting** preparation
- **Obsidian callouts** support
- **Tables, lists, blockquotes** properly rendered

## 🚀 Usage

### Viewing the Knowledge Garden

1. Open `garden-m3.html` in your browser
2. Browse notes via the navigation drawer (click menu icon)
3. Toggle light/dark theme with the theme button
4. Click internal links to navigate between notes

### Configuration

Update the repository details in `garden-m3.js`:

```javascript
this.vaultOwner = 'AIMDaAlien';
this.vaultRepo = 'obsidian-vault';
this.branch = 'main';
```

### Privacy Settings

Protected folders are defined in `garden-m3.js`:

```javascript
this.privateFolders = ['Career', 'Myself'];
```

These folders are also excluded in `.gitignore`.

## 📁 File Structure

```
├── garden-m3.html          # Main HTML structure
├── garden-m3.css           # Material Design 3 styles
├── garden-m3.js            # Fixed markdown parser & navigation
├── .gitignore              # Privacy protection
└── README-M3.md            # This file
```

## 🎯 Material 3 Components Used

- **Top App Bar** - Fixed header with navigation and actions
- **Navigation Rail** - Vertical navigation for desktop
- **Navigation Drawer** - Collapsible sidebar with folder structure
- **Cards** - Elevated content containers
- **Buttons** - Filled tonal and icon buttons
- **Typography Scale** - Semantic text styles

## 🔧 Technical Details

### Color System
- Primary: Periwinkle (#7C4DFF)
- Secondary: Lavender (#B388FF)
- Surface containers with proper elevation
- Outline variants for subtle borders

### Typography
- Font: Roboto Flex (variable font)
- Monospace: Roboto Mono
- Scale: Display → Headline → Title → Body → Label

### Responsive Breakpoints
- Compact: < 600px (Mobile)
- Medium: 600-839px (Tablet)
- Expanded: 840-1239px (Desktop)
- Large: ≥ 1240px (Wide Desktop)

## 🔒 Privacy & Security

**What's Protected:**
- Career folder (professional information)
- Myself folder (personal notes)
- .obsidian workspace files
- System files (.DS_Store)

**How It Works:**
1. `.gitignore` prevents sensitive files from being committed
2. JavaScript parser filters out private folders
3. GitHub API only exposes public repository content

## 🎨 Customization

### Changing Colors
Edit the CSS custom properties in `garden-m3.css`:

```css
:root {
  --md-sys-color-primary: #YourColor;
  --md-sys-color-secondary: #YourColor;
}
```

### Adding Protected Folders
Update both `.gitignore` and `garden-m3.js`:

```javascript
this.privateFolders = ['Career', 'Myself', 'NewPrivateFolder'];
```

### Typography
Modify the typescale in `garden-m3.css`:

```css
--md-sys-typescale-body-large: 400 16px/24px 'Your Font', sans-serif;
```

## 📝 Markdown Support

**Supported Syntax:**
- Headers (H1-H6)
- **Bold**, *italic*, `code`
- Lists (ordered & unordered)
- [Links](url) and [[Wiki Links]]
- ```code blocks```
- > Blockquotes
- Tables
- Obsidian callouts (> [!note])

## 🌐 Deployment

### GitHub Pages
1. Push to your repository
2. Enable GitHub Pages in Settings
3. Set source to main branch
4. Access at: `https://yourusername.github.io/repo-name/garden-m3.html`

### Custom Domain
1. Add CNAME file with your domain
2. Configure DNS with A records
3. Enable HTTPS in GitHub settings

## 🛠️ Troubleshooting

**Notes not loading:**
- Check repository name in `garden-m3.js`
- Verify GitHub API rate limits
- Open browser console for errors

**Markdown not parsing:**
- Ensure marked.js CDN is accessible
- Check browser console for script errors
- Verify content doesn't have conflicting HTML

**Private folders showing:**
- Confirm .gitignore is committed
- Check privateFolders array in JS
- Verify folder names match exactly

## 📚 Resources

- [Material Design 3](https://m3.material.io/)
- [Marked.js Documentation](https://marked.js.org/)
- [Obsidian](https://obsidian.md/)

## 🙏 Acknowledgments

- **Material Design** by Google
- **Marked.js** for markdown parsing
- **Obsidian** for the knowledge management philosophy

---

Built with ❤️ and Material Design 3 | よろしくお願いします (Yoroshiku onegaishimasu)
