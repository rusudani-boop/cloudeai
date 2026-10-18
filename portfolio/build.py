"""Build the portfolio: index.html for GitHub Pages and a self-contained copy with the photo inlined."""
import base64, pathlib, sys
here = pathlib.Path(__file__).parent
src = (here / "src/portfolio.html").read_text(encoding="utf-8")
photo = base64.b64encode((here / "nana.jpg").read_bytes()).decode()
head = '<!doctype html>\n<html lang="ka">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
title_end = src.index("</style>") + len("</style>")
page = head + src[:title_end] + "\n</head>\n<body>\n" + src[title_end:].lstrip() + "\n</body>\n</html>\n"
(here / "index.html").write_text(page.replace("__PHOTO__", "nana.jpg"), encoding="utf-8")
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else here / "portfolio-standalone.html"
out.write_text(src.replace("__PHOTO__", "data:image/jpeg;base64," + photo), encoding="utf-8")
