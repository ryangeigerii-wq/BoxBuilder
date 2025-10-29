# app/templates/

Jinja2 templates for HTML pages.

Key Templates:
- box_builder.html: Interactive builder UI.
- index.html: Home navigation & workspace placeholders.

Conventions:
- Cache bust static assets with `?v={{ cache_bust }}`.
- Favor semantic markup & accessible labels.

Notes:
- Interactive logic lives in `static/js/box_builder.js`.
- Keep inline scripting minimal—prefer external JS for maintainability.

---
