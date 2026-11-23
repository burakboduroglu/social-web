# Brand assets

The social-web mark uses two overlapping conversation shapes in lavender (`#b8abff`) and light ink (`#eeedf5`) on the app's dark background. It is native SVG geometry with no font or image service dependency.

- `public/assets/social-web-mark.svg`: compact 96 × 96 mark; used in the shared Brand component and favicon.
- `public/assets/social-web-wordmark.svg`: optional horizontal lockup. Its text uses system fonts; the application itself uses live text for accessible, responsive branding.
- `src/brand.tsx`: shared accessible navigation brand for the auth screens and app sidebar.

Source brief and SVGs were prepared in the studio workspace with a Luna subagent. Affinity and raster image generation were not used. Exported project assets are stored in this repository and do not depend on the studio workspace at runtime.

## Pixel illustration sources

UI icons use the MIT-licensed Pixelarticons library. Empty states, error scenes and seeded avatars are native pixel components (`src/components/illustration.tsx`, `src/components/pixel-character.tsx`), so they stay crisp, themeable and dependency-free.

Reference and stock sources for new pixel artwork:

| Source | Use | Licence note |
| --- | --- | --- |
| <https://www.istockphoto.com/tr/illüstrasyon/pixel-art> | Paid stock illustrations | Per-asset iStock licence. Do not hotlink or redistribute previews. |
| <https://pixeliconlibrary.com> | Free pixel icon sets | Check each set's licence; some require attribution. |
| <https://www.magnific.com/free-photos-vectors/pixel-illustration> | Free vectors and photos (Freepik family) | Free tier usually requires attribution; paid plans differ. |

Download chosen assets into the repository, record the source and licence next to the file, and match the existing dark palette (`#b8abff`, `#eeedf5`). Prefer native pixel components for small UI states; use raster or vector art only when it earns the extra weight.
