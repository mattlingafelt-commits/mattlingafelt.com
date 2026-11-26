# mattlingafelt.com

Source for Matt Lingafelt's public profile and HT 930 portfolio site. Seven static pages (Home, Current project, Statements, Teaching, About, CV, Privacy) in the "Glossa" design. Each page carries its own design styles inline; `css/base.css` holds the self-hosted fonts (`fonts/`, SIL Open Font License, see the license files there), the skip link, focus styles and phone tweaks. `js/room.js` runs the room scroll story on the Current project page. No build step, no cookies, no trackers, no third-party requests. Security headers live in `_headers`; old URLs (`/work`, `/reflection`, `/archive`) redirect via `_redirects`.

Hosted on Cloudflare Pages. Pushing to `main` deploys.
