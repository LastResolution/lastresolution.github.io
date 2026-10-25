# LastResolution

The source for [lastresolution.github.io](https://lastresolution.github.io/): an independent software portfolio, starting with [ReStart](https://lastresolution.github.io/ReStart/).

The site is plain HTML, CSS and JavaScript, with no framework, third-party scripts, analytics, remote fonts or build dependencies. A small Node script assembles an explicit list of public files for GitHub Pages.

## Develop

Use Node.js 22 or newer and PowerShell 7 for the privacy check.

```sh
node --test scripts/verify-site.test.mjs scripts/check-privacy.test.mjs
node scripts/verify-site.mjs
node scripts/build-site.mjs
python -m http.server 8793 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8793/`. Run the build script again after editing. The build rejects unexpected output files rather than publishing them.

## Publish

The Pages workflow checks metadata, structured data, links, assets, accessibility essentials and content privacy before deploying `dist/`. Pull requests run checks without publishing. The root sitemap contains this site; `robots.txt` also advertises ReStart's separately maintained sitemap.

Keep the root `WebSite` name and `og:site_name` consistent with LastResolution. Google selects search appearance automatically; deployment does not immediately change an indexed site name or favicon. Use Search Console and Bing Webmaster Tools to request a fresh crawl after publication.

## Content and privacy

Public identity is limited to the LastResolution handle and public project/support URLs. Do not add private contact details, local paths, application inventories, settings, credentials or unpublished projects. Use a GitHub noreply commit identity and run `scripts/check-privacy.ps1 -Staged` before committing.

ReStart screenshots use its English demonstration layout and sample data. They and the ReStart logo come from the [ReStart repository](https://github.com/LastResolution/ReStart). Third-party product names and icons shown within the screenshots belong to their respective owners. The profile artwork was supplied by LastResolution; its metadata is removed from the public copy. Favicons and the social preview reuse that artwork. The optional `scripts/render-brand.py` helper regenerates these derivatives from `assets/avatar.png` using Pillow and local fonts.

Source and artwork are available under the [MIT license](LICENSE).
