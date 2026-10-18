# Nana Sanikidze — portfolio & CV

- `index.html` + `nana.jpg` — the portfolio site (Georgian / English toggle). Edit `src/portfolio.html`, then run `python3 build.py` to regenerate `index.html`.
- `cv/` — the CV in Georgian and English. Edit `cv-ka.html` / `cv-en.html` / `cv.css`, then run `node cv/make-pdf.js` (needs Playwright) to regenerate the PDFs.

To publish the site for free: enable GitHub Pages for this repository (Settings → Pages → deploy from branch), and the portfolio will be at `/portfolio/`.
