# Icon Files Required for PWA

Place the following icon files in this directory:

- `icon-192.png` - 192x192 PNG icon for PWA
- `icon-512.png` - 512x512 PNG icon for PWA

For development, you can use placeholder icons or generate them from the project logo.

## PWA Limitations

This application can be installed as a Progressive Web App (PWA). Currently, the PWA configuration:

- ✅ Works offline with service worker caching
- ✅ Supports installation on desktop and mobile devices
- ⚠️ Uses default browser icon (custom icons not configured)

To add custom PWA icons:
1. Add icon files to this directory:
   - icon-192x192.png (192x192 pixels)
   - icon-512x512.png (512x512 pixels)
2. Update `vite.config.js` VitePWA configuration:
   ```javascript
   icons: [
     { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
     { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
   ]
   ```
